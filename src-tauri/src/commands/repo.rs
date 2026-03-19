use git2::Repository;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;
use tauri::Manager;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RepoInfo {
    pub id: String,
    pub path: String,
    pub name: String,
    pub description: Option<String>,
    pub current_branch: String,
    pub is_dirty: bool,
    pub ahead_count: usize,
    pub behind_count: usize,
    pub added_at: u64,
    pub last_commit: Option<crate::commands::git::CommitSummary>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    pub kind: String,   // "file" | "directory"
    pub children: Option<Vec<TreeNode>>,
    pub status_kind: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserSettings {
    pub author_name: String,
    pub author_email: String,
    pub theme: String,
    pub default_branch: String,
    pub fetch_on_open: bool,
    pub show_hidden_files: bool,
}

impl Default for UserSettings {
    fn default() -> Self {
        UserSettings {
            author_name: String::new(),
            author_email: String::new(),
            theme: "dark".to_string(),
            default_branch: "main".to_string(),
            fetch_on_open: false,
            show_hidden_files: false,
        }
    }
}

fn repo_data_path(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("repos.json")
}

fn settings_path(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("settings.json")
}

fn open(path: &str) -> Result<Repository, String> {
    Repository::open(path).map_err(|e| e.message().to_string())
}

fn get_current_branch(repo: &Repository) -> String {
    repo.head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()))
        .unwrap_or_else(|| "HEAD".to_string())
}

fn get_is_dirty(repo: &Repository) -> bool {
    let mut opts = git2::StatusOptions::new();
    opts.include_untracked(false);
    repo.statuses(Some(&mut opts))
        .map(|s| !s.is_empty())
        .unwrap_or(false)
}

fn get_last_commit(repo: &Repository) -> Option<crate::commands::git::CommitSummary> {
    let head = repo.head().ok()?;
    let commit = head.peel_to_commit().ok()?;

    // Extract every borrowed field into owned Strings BEFORE constructing
    // the return value. This ensures the Signature temporaries (which borrow
    // from `commit`) are fully dropped before the block closes.
    let oid_str      = commit.id().to_string();
    let short_oid    = oid_str[..7].to_string();
    let message      = commit.summary().unwrap_or("").to_string();
    let author_name  = commit.author().name().unwrap_or("").to_string();
    let author_email = commit.author().email().unwrap_or("").to_string();
    let timestamp    = commit.author().when().seconds();
    let parent_oids: Vec<String> = (0..commit.parent_count())
        .filter_map(|i| commit.parent_id(i).ok().map(|id| id.to_string()))
        .collect();

    Some(crate::commands::git::CommitSummary {
        oid: oid_str,
        short_oid,
        message,
        author_name,
        author_email,
        timestamp,
        parent_oids,
    })
}

// Builds file tree recursively, skipping .git
pub fn build_file_tree(repo_path: &str) -> Result<Vec<TreeNode>, String> {
    fn walk_dir(dir: &Path, base: &Path) -> Vec<TreeNode> {
        let mut nodes = Vec::new();
        let entries = match fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return nodes,
        };

        let mut entries: Vec<_> = entries.flatten().collect();
        entries.sort_by_key(|e| {
            let is_file = e.file_type().map(|t| t.is_file()).unwrap_or(false);
            (is_file as u8, e.file_name())
        });

        for entry in entries {
            let name = entry.file_name().to_string_lossy().to_string();
            if name == ".git" || name.starts_with('.') { continue; }

            let path = entry.path();
            let rel = path.strip_prefix(base).unwrap_or(&path);
            let rel_str = rel.to_string_lossy().replace('\\', "/");
            let ft = entry.file_type().unwrap();

            if ft.is_dir() {
                let children = walk_dir(&path, base);
                nodes.push(TreeNode {
                    name,
                    path: rel_str,
                    kind: "directory".to_string(),
                    children: Some(children),
                    status_kind: None,
                });
            } else {
                nodes.push(TreeNode {
                    name,
                    path: rel_str,
                    kind: "file".to_string(),
                    children: None,
                    status_kind: None,
                });
            }
        }
        nodes
    }

    let base = Path::new(repo_path);
    Ok(walk_dir(base, base))
}

/// open_repo — validate a path is a git repo and return its info
#[tauri::command]
pub fn open_repo(path: String) -> Result<RepoInfo, String> {
    let repo = open(&path)?;
    let name = Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    let current_branch = get_current_branch(&repo);
    let is_dirty = get_is_dirty(&repo);
    let last_commit = get_last_commit(&repo);

    Ok(RepoInfo {
        id: uuid_from_path(&path),
        path: path.clone(),
        name,
        description: None,
        current_branch,
        is_dirty,
        ahead_count: 0,
        behind_count: 0,
        added_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        last_commit,
    })
}

/// get_repo_status — refresh status fields for an open repo
#[tauri::command]
pub fn get_repo_status(path: String) -> Result<serde_json::Value, String> {
    let repo = open(&path)?;
    Ok(serde_json::json!({
        "currentBranch": get_current_branch(&repo),
        "isDirty": get_is_dirty(&repo),
        "aheadCount": 0,
        "behindCount": 0,
    }))
}

/// get_recent_repos — read saved repo list from disk
#[tauri::command]
pub fn get_recent_repos(app: tauri::AppHandle) -> Result<Vec<RepoInfo>, String> {
    let path = repo_data_path(&app);
    if !path.exists() { return Ok(vec![]); }
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| e.to_string())
}

/// save_recent_repo — persist a repo to the saved list
#[tauri::command]
pub fn save_recent_repo(app: tauri::AppHandle, repo: RepoInfo) -> Result<(), String> {
    let path = repo_data_path(&app);
    let mut repos: Vec<RepoInfo> = if path.exists() {
        let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        vec![]
    };

    // Remove existing entry for same path, then prepend
    repos.retain(|r| r.path != repo.path);
    repos.insert(0, repo);
    repos.truncate(20); // keep last 20

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let data = serde_json::to_string_pretty(&repos).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

/// remove_recent_repo — remove a repo from saved list
#[tauri::command]
pub fn remove_recent_repo(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let data_path = repo_data_path(&app);
    if !data_path.exists() { return Ok(()); }
    let data = fs::read_to_string(&data_path).map_err(|e| e.to_string())?;
    let mut repos: Vec<RepoInfo> = serde_json::from_str(&data).unwrap_or_default();
    repos.retain(|r| r.path != path);
    let data = serde_json::to_string_pretty(&repos).map_err(|e| e.to_string())?;
    fs::write(&data_path, data).map_err(|e| e.to_string())?;
    Ok(())
}

/// get_settings — read user settings from disk
#[tauri::command]
pub fn get_settings(app: tauri::AppHandle) -> Result<UserSettings, String> {
    let path = settings_path(&app);
    if !path.exists() { return Ok(UserSettings::default()); }
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| e.to_string())
}

/// save_settings — write user settings to disk
#[tauri::command]
pub fn save_settings(app: tauri::AppHandle, settings: UserSettings) -> Result<(), String> {
    let path = settings_path(&app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let data = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

// Simple deterministic ID from path
fn uuid_from_path(path: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut h = DefaultHasher::new();
    path.hash(&mut h);
    format!("{:x}", h.finish())
}

/// clone_repo — clone a remote URL to a local path
#[tauri::command]
pub fn clone_repo(url: String, local_path: String) -> Result<RepoInfo, String> {
    git2::Repository::clone(&url, &local_path)
        .map_err(|e| e.message().to_string())?;
    open_repo(local_path)
}