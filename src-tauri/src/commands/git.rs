use git2::{Repository, Signature, StatusOptions};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

// ── Shared response types (must match src/types/index.ts exactly) ─────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CommitSummary {
    pub oid: String,
    pub short_oid: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: i64,
    pub parent_oids: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileStatus {
    pub path: String,
    pub old_path: Option<String>,
    pub kind: String,
    pub is_staged: bool,
    pub is_unstaged: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HunkLine {
    pub kind: String,       // "context" | "addition" | "deletion"
    pub content: String,
    pub old_line_no: Option<u32>,
    pub new_line_no: Option<u32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Hunk {
    pub header: String,
    pub lines: Vec<HunkLine>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileChange {
    pub path: String,
    pub old_path: Option<String>,
    pub kind: String,
    pub hunks: Vec<Hunk>,
    pub is_binary: bool,
}

// ── Helper: open repo ──────────────────────────────────────────────────────────

fn open(path: &str) -> Result<Repository, String> {
    Repository::open(path).map_err(|e| e.message().to_string())
}

// ── Commands ───────────────────────────────────────────────────────────────────

/// git init — create a new empty repository
#[tauri::command]
pub fn init_repo(path: String) -> Result<String, String> {
    Repository::init(&path).map_err(|e| e.message().to_string())?;
    Ok(format!("Initialized empty Git repository in {}/.git", path))
}

/// get_status — list all changed files in working tree and index
#[tauri::command]
pub fn get_status(repo_path: String) -> Result<Vec<FileStatus>, String> {
    let repo = open(&repo_path)?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);

    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.message().to_string())?;
    let mut result = Vec::new();

    for entry in statuses.iter() {
        let status = entry.status();
        let path = entry.path().unwrap_or("").to_string();

        // Staged changes (index vs HEAD)
        let is_staged = status.intersects(
            git2::Status::INDEX_NEW
                | git2::Status::INDEX_MODIFIED
                | git2::Status::INDEX_DELETED
                | git2::Status::INDEX_RENAMED,
        );

        // Unstaged changes (workdir vs index)
        let is_unstaged = status.intersects(
            git2::Status::WT_NEW
                | git2::Status::WT_MODIFIED
                | git2::Status::WT_DELETED
                | git2::Status::WT_RENAMED,
        );

        let kind = if status.contains(git2::Status::CONFLICTED) {
            "conflicted"
        } else if status.intersects(git2::Status::INDEX_NEW | git2::Status::WT_NEW) {
            if is_staged { "added" } else { "untracked" }
        } else if status.intersects(git2::Status::INDEX_DELETED | git2::Status::WT_DELETED) {
            "deleted"
        } else if status.intersects(git2::Status::INDEX_RENAMED | git2::Status::WT_RENAMED) {
            "renamed"
        } else {
            "modified"
        };

        if is_staged || is_unstaged {
            result.push(FileStatus {
                path,
                old_path: None,
                kind: kind.to_string(),
                is_staged,
                is_unstaged,
            });
        }
    }

    Ok(result)
}

/// stage_file — git add <path>
#[tauri::command]
pub fn stage_file(repo_path: String, file_path: String) -> Result<(), String> {
    let repo = open(&repo_path)?;
    let mut index = repo.index().map_err(|e| e.message().to_string())?;
    index.add_path(Path::new(&file_path)).map_err(|e| e.message().to_string())?;
    index.write().map_err(|e| e.message().to_string())?;
    Ok(())
}

/// unstage_file — git restore --staged <path>
#[tauri::command]
pub fn unstage_file(repo_path: String, file_path: String) -> Result<(), String> {
    let repo = open(&repo_path)?;
    // reset_default takes the commit object (not tree), and resets index entries to HEAD
    match repo.head() {
        Ok(head) => {
            let head_commit = head.peel_to_commit().map_err(|e| e.message().to_string())?;
            repo.reset_default(Some(head_commit.as_object()), &[&file_path])
                .map_err(|e| e.message().to_string())?;
        }
        Err(_) => {
            // No commits yet — just remove the file from the index
            let mut index = repo.index().map_err(|e| e.message().to_string())?;
            index.remove_path(std::path::Path::new(&file_path))
                .map_err(|e| e.message().to_string())?;
            index.write().map_err(|e| e.message().to_string())?;
        }
    }
    Ok(())
}

/// stage_all — git add -A
#[tauri::command]
pub fn stage_all(repo_path: String) -> Result<(), String> {
    let repo = open(&repo_path)?;
    let mut index = repo.index().map_err(|e| e.message().to_string())?;
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| e.message().to_string())?;
    index.write().map_err(|e| e.message().to_string())?;
    Ok(())
}

/// create_commit — create a commit with the current index
#[tauri::command]
pub fn create_commit(
    repo_path: String,
    message: String,
    author_name: String,
    author_email: String,
) -> Result<CommitSummary, String> {
    let repo = open(&repo_path)?;
    let mut index = repo.index().map_err(|e| e.message().to_string())?;
    let tree_oid = index.write_tree().map_err(|e| e.message().to_string())?;
    let tree = repo.find_tree(tree_oid).map_err(|e| e.message().to_string())?;

    let sig = Signature::now(&author_name, &author_email)
        .map_err(|e| e.message().to_string())?;

    // Parent: HEAD if it exists, otherwise this is the root commit
    let parents: Vec<git2::Commit> = match repo.head() {
        Ok(head) => vec![head.peel_to_commit().map_err(|e| e.message().to_string())?],
        Err(_) => vec![],
    };
    let parent_refs: Vec<&git2::Commit> = parents.iter().collect();

    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, &message, &tree, &parent_refs)
        .map_err(|e| e.message().to_string())?;

    let short_oid = &oid.to_string()[..7];
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    Ok(CommitSummary {
        oid: oid.to_string(),
        short_oid: short_oid.to_string(),
        message,
        author_name,
        author_email,
        timestamp,
        parent_oids: parent_refs.iter().map(|c| c.id().to_string()).collect(),
    })
}

/// get_commit_log — return last `limit` commits from `ref`
#[tauri::command]
pub fn get_commit_log(
    repo_path: String,
    limit: usize,
    ref_name: String,
) -> Result<Vec<CommitSummary>, String> {
    let repo = open(&repo_path)?;
    let mut revwalk = repo.revwalk().map_err(|e| e.message().to_string())?;
    revwalk.set_sorting(git2::Sort::TIME).map_err(|e| e.message().to_string())?;

    // Push the starting ref
    if ref_name == "HEAD" {
        revwalk.push_head().map_err(|e| e.message().to_string())?;
    } else {
        let obj = repo.revparse_single(&ref_name).map_err(|e| e.message().to_string())?;
        revwalk.push(obj.id()).map_err(|e| e.message().to_string())?;
    }

    let mut commits = Vec::new();
    for (idx, oid) in revwalk.enumerate() {
        if idx >= limit { break; }
        let oid = oid.map_err(|e| e.message().to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.message().to_string())?;

        let message = commit
            .summary()
            .unwrap_or("")
            .to_string();

        let parent_oids = (0..commit.parent_count())
            .map(|i| commit.parent_id(i).map(|id| id.to_string()).unwrap_or_default())
            .collect();

        commits.push(CommitSummary {
            oid: oid.to_string(),
            short_oid: oid.to_string()[..7].to_string(),
            message,
            author_name: commit.author().name().unwrap_or("").to_string(),
            author_email: commit.author().email().unwrap_or("").to_string(),
            timestamp: commit.author().when().seconds(),
            parent_oids,
        });
    }

    Ok(commits)
}

/// discard_file — restore a file to its HEAD state (destructive)
#[tauri::command]
pub fn discard_file(repo_path: String, file_path: String) -> Result<(), String> {
    let repo = open(&repo_path)?;
    let head = repo.head().map_err(|e| e.message().to_string())?;
    let head_commit = head.peel_to_commit().map_err(|e| e.message().to_string())?;

    // Checkout the file from HEAD tree to working directory
    let head_tree = head_commit.tree().map_err(|e| e.message().to_string())?;
    let mut checkout_builder = git2::build::CheckoutBuilder::new();
    checkout_builder.path(&file_path).force().update_index(true);
    repo.checkout_tree(head_tree.as_object(), Some(&mut checkout_builder))
        .map_err(|e| e.message().to_string())?;
    Ok(())
}

/// stash_push — git stash push
#[tauri::command]
pub fn stash_push(repo_path: String, message: Option<String>) -> Result<(), String> {
    let mut repo = open(&repo_path)?;
    // We need the stasher's signature
    let sig = repo.signature().map_err(|e| e.message().to_string())?;
    let msg = message.as_deref().unwrap_or("WIP on HEAD");
    repo.stash_save(&sig, msg, None).map_err(|e| e.message().to_string())?;
    Ok(())
}

/// stash_pop — git stash pop
#[tauri::command]
pub fn stash_pop(repo_path: String) -> Result<(), String> {
    let mut repo = open(&repo_path)?;
    repo.stash_pop(0, None).map_err(|e| e.message().to_string())?;
    Ok(())
}

/// get_commit_detail — full commit info including all file diffs
#[tauri::command]
pub fn get_commit_detail(repo_path: String, oid: String) -> Result<serde_json::Value, String> {
    let repo = open(&repo_path)?;
    let git_oid = git2::Oid::from_str(&oid).map_err(|e| e.message().to_string())?;
    let commit = repo.find_commit(git_oid).map_err(|e| e.message().to_string())?;

    let summary = CommitSummary {
        oid: oid.clone(),
        short_oid: oid[..7].to_string(),
        message: commit.summary().unwrap_or("").to_string(),
        author_name: commit.author().name().unwrap_or("").to_string(),
        author_email: commit.author().email().unwrap_or("").to_string(),
        timestamp: commit.author().when().seconds(),
        parent_oids: (0..commit.parent_count())
            .filter_map(|i| commit.parent_id(i).ok().map(|id| id.to_string()))
            .collect(),
    };

    let body = commit.body().unwrap_or("").to_string();

    // Get the file changes for this commit
    let files = crate::commands::diff::get_commit_diff(repo_path, oid)
        .unwrap_or_default();

    Ok(serde_json::json!({
        "oid": summary.oid,
        "shortOid": summary.short_oid,
        "message": summary.message,
        "body": body,
        "authorName": summary.author_name,
        "authorEmail": summary.author_email,
        "timestamp": summary.timestamp,
        "parentOids": summary.parent_oids,
        "files": files,
    }))
}

/// revert_commit — creates a new commit that undoes the changes from a given commit.
/// Non-destructive: history is preserved, a new "revert of X" commit is added on top.
#[tauri::command]
pub fn revert_commit(repo_path: String, oid: String) -> Result<CommitSummary, String> {
    let repo = open(&repo_path)?;
    let git_oid = git2::Oid::from_str(&oid).map_err(|e| e.message().to_string())?;
    let commit = repo.find_commit(git_oid).map_err(|e| e.message().to_string())?;

    let mut revert_opts = git2::RevertOptions::new();
    repo.revert(&commit, Some(&mut revert_opts))
        .map_err(|e| e.message().to_string())?;

    let sig = repo.signature().map_err(|e| e.message().to_string())?;
    let mut index = repo.index().map_err(|e| e.message().to_string())?;
    let tree_oid = index.write_tree().map_err(|e| e.message().to_string())?;
    let tree = repo.find_tree(tree_oid).map_err(|e| e.message().to_string())?;

    let head_commit = repo.head()
        .map_err(|e| e.message().to_string())?
        .peel_to_commit()
        .map_err(|e| e.message().to_string())?;

    let short = if oid.len() >= 7 { &oid[..7] } else { &oid };
    let message = format!(
        "Revert \"{}\"\n\nThis reverts commit {}.",
        commit.summary().unwrap_or(""),
        short
    );

    let new_oid = repo.commit(
        Some("HEAD"), &sig, &sig, &message, &tree, &[&head_commit],
    ).map_err(|e| e.message().to_string())?;

    let short_new = new_oid.to_string();
    let short_new = &short_new[..7];

    Ok(CommitSummary {
        oid: new_oid.to_string(),
        short_oid: short_new.to_string(),
        message,
        author_name: sig.name().unwrap_or("").to_string(),
        author_email: sig.email().unwrap_or("").to_string(),
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64,
        parent_oids: vec![head_commit.id().to_string()],
    })
}