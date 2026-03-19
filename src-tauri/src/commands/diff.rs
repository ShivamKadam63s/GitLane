use git2::{Repository, DiffOptions, DiffLineType, DiffFormat};
use crate::commands::git::{FileChange, Hunk, HunkLine};

fn open(path: &str) -> Result<Repository, String> {
    Repository::open(path).map_err(|e| e.message().to_string())
}

fn parse_diff(diff: git2::Diff) -> Result<Vec<FileChange>, String> {
    let mut changes: Vec<FileChange> = Vec::new();

    diff.print(DiffFormat::Patch, |delta, hunk, line| {
        let file_path = delta
            .new_file()
            .path()
            .or_else(|| delta.old_file().path())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        let old_path = delta.old_file().path()
            .map(|p| p.to_string_lossy().to_string())
            .filter(|p| p != &file_path);

        let kind = match delta.status() {
            git2::Delta::Modified => "modified",
            git2::Delta::Added => "added",
            git2::Delta::Deleted => "deleted",
            git2::Delta::Renamed => "renamed",
            git2::Delta::Copied => "copied",
            git2::Delta::Conflicted => "conflicted",
            _ => "modified",
        };

        let is_binary = delta.new_file().is_binary() || delta.old_file().is_binary();

        // Find or create the FileChange for this path
        let change = if let Some(pos) = changes.iter().position(|c| c.path == file_path) {
            &mut changes[pos]
        } else {
            changes.push(FileChange {
                path: file_path.clone(),
                old_path,
                kind: kind.to_string(),
                hunks: Vec::new(),
                is_binary,
            });
            changes.last_mut().unwrap()
        };

        if let Some(h) = hunk {
            let header = String::from_utf8_lossy(h.header()).trim().to_string();
            if change.hunks.last().map(|hk: &Hunk| hk.header != header).unwrap_or(true) {
                change.hunks.push(Hunk {
                    header,
                    lines: Vec::new(),
                });
            }
        }

        if let Some(current_hunk) = change.hunks.last_mut() {
            let line_kind = match line.origin_value() {
                DiffLineType::Addition => "addition",
                DiffLineType::Deletion => "deletion",
                DiffLineType::Context => "context",
                _ => return true,
            };

            let content = String::from_utf8_lossy(line.content())
                .trim_end_matches('\n')
                .trim_end_matches('\r')
                .to_string();

            current_hunk.lines.push(HunkLine {
                kind: line_kind.to_string(),
                content,
                old_line_no: line.old_lineno(),
                new_line_no: line.new_lineno(),
            });
        }

        true
    })
    .map_err(|e| e.message().to_string())?;

    Ok(changes)
}

/// get_file_diff — unstaged diff for a single working tree file
#[tauri::command]
pub fn get_file_diff(repo_path: String, file_path: String) -> Result<FileChange, String> {
    let repo = open(&repo_path)?;

    let mut opts = DiffOptions::new();
    opts.pathspec(&file_path);

    let diff = repo
        .diff_index_to_workdir(None, Some(&mut opts))
        .map_err(|e| e.message().to_string())?;

    let changes = parse_diff(diff)?;
    changes.into_iter().next().ok_or_else(|| "No diff found for file".to_string())
}

/// get_staged_diff — staged diff for a single file (index vs HEAD)
#[tauri::command]
pub fn get_staged_diff(repo_path: String, file_path: String) -> Result<FileChange, String> {
    let repo = open(&repo_path)?;

    let head_tree = repo
        .head()
        .ok()
        .and_then(|h| h.peel_to_tree().ok());

    let mut opts = DiffOptions::new();
    opts.pathspec(&file_path);

    let diff = repo
        .diff_tree_to_index(head_tree.as_ref(), None, Some(&mut opts))
        .map_err(|e| e.message().to_string())?;

    let changes = parse_diff(diff)?;
    changes.into_iter().next().ok_or_else(|| "No staged diff found for file".to_string())
}

/// get_commit_diff — all changes introduced by a specific commit
#[tauri::command]
pub fn get_commit_diff(repo_path: String, oid: String) -> Result<Vec<FileChange>, String> {
    let repo = open(&repo_path)?;
    let obj = repo.revparse_single(&oid).map_err(|e| e.message().to_string())?;
    let commit = obj.peel_to_commit().map_err(|e| e.message().to_string())?;
    let tree = commit.tree().map_err(|e| e.message().to_string())?;

    let parent_tree = commit
        .parent(0)
        .ok()
        .and_then(|p| p.tree().ok());

    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), None)
        .map_err(|e| e.message().to_string())?;

    parse_diff(diff)
}

/// get_file_tree — build directory tree for the working dir
#[tauri::command]
pub fn get_file_tree(repo_path: String) -> Result<Vec<crate::commands::repo::TreeNode>, String> {
    crate::commands::repo::build_file_tree(&repo_path)
}

/// get_file_content — raw file content
#[tauri::command]
pub fn get_file_content(
    repo_path: String,
    file_path: String,
    ref_name: String,
) -> Result<String, String> {
    if ref_name == "WORKDIR" {
        let full_path = std::path::Path::new(&repo_path).join(&file_path);
        return std::fs::read_to_string(full_path)
            .map_err(|e| e.to_string());
    }

    let repo = open(&repo_path)?;
    let obj = repo.revparse_single(&format!("{}:{}", ref_name, file_path))
        .map_err(|e| e.message().to_string())?;
    let blob = obj.peel_to_blob().map_err(|e| e.message().to_string())?;
    String::from_utf8(blob.content().to_vec())
        .map_err(|e| e.to_string())
}