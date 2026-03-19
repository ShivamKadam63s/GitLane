use git2::{Cred, FetchOptions, PushOptions, RemoteCallbacks, Repository};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::Manager;

// ── Data types ────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RemoteInfo {
    pub name: String,
    pub url: String,
    pub fetch_url: Option<String>,
    pub push_url: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PushResult {
    pub success: bool,
    pub needs_credentials: bool,
    pub error: Option<String>,
    pub pushed_ref: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FetchResult {
    pub success: bool,
    pub needs_credentials: bool,
    pub error: Option<String>,
    pub updated_refs: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct StoredCredential {
    pub host: String,
    pub username: String,
}

// ── Credential storage ────────────────────────────────────────────────────────

fn creds_path(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("credentials.json")
}

fn load_credentials(app: &tauri::AppHandle) -> Vec<serde_json::Value> {
    let path = creds_path(app);
    if !path.exists() { return vec![]; }
    let data = std::fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&data).unwrap_or_default()
}

fn save_credentials(app: &tauri::AppHandle, creds: &Vec<serde_json::Value>) {
    let path = creds_path(app);
    if let Some(parent) = path.parent() { let _ = std::fs::create_dir_all(parent); }
    let data = serde_json::to_string_pretty(creds).unwrap_or_default();
    let _ = std::fs::write(path, data);
}

fn get_credential_for_host(app: &tauri::AppHandle, host: &str) -> Option<(String, String)> {
    let creds = load_credentials(app);
    for cred in &creds {
        if cred["host"].as_str() == Some(host) {
            let username = cred["username"].as_str()?.to_string();
            // Token stored as plain text (no encoding)
            let token = cred["token"].as_str()?.to_string();
            if token.is_empty() { return None; }
            return Some((username, token));
        }
    }
    None
}

// Token is stored as plain text in the app data directory.
// The credentials file is in a user-private OS directory, same security
// as VS Code's stored tokens. No obfuscation needed.

pub fn extract_host(url: &str) -> String {
    if url.starts_with("git@") {
        url.trim_start_matches("git@").split(':').next().unwrap_or(url).to_string()
    } else {
        url.split("://").nth(1).unwrap_or(url).split('/').next().unwrap_or(url).to_string()
    }
}

fn open(path: &str) -> Result<Repository, String> {
    Repository::open(path).map_err(|e| e.message().to_string())
}

// ── Key fix: use Arc<Mutex<>> so closures OWN their data instead of borrowing ──
//
// Previously: closure captured `&mut updated_refs` and `&mut needs_creds`
// The RemoteCallbacks/FetchOptions structs hold those closures alive for their
// entire lifetime, so Rust refuses to let you use those variables again after
// the closure is registered.
//
// Fix: wrap in Arc<Mutex<bool>> / Arc<Mutex<Vec<String>>>.
// The closure captures a CLONE of the Arc (an owned handle, not a borrow).
// After fetch/push completes and options are dropped, we read the values
// through the original Arc. No lifetime conflict.

fn build_fetch_callbacks<'a>(
    username: Option<String>,
    token: Option<String>,
    needs_creds: Arc<Mutex<bool>>,
    updated_refs: Arc<Mutex<Vec<String>>>,
) -> RemoteCallbacks<'a> {
    let mut callbacks = RemoteCallbacks::new();
    let username = username.unwrap_or_default();
    let token = token.unwrap_or_default();

    // Clone the Arc so the closure owns its own handle
    let nc = Arc::clone(&needs_creds);
    callbacks.credentials(move |_url, username_from_url, _allowed| {
        if token.is_empty() {
            *nc.lock().unwrap() = true;
            Err(git2::Error::from_str("No credentials available"))
        } else {
            let uname = if !username.is_empty() {
                username.clone()
            } else {
                username_from_url.unwrap_or("git").to_string()
            };
            Cred::userpass_plaintext(&uname, &token)
        }
    });

    // Clone the Arc so this closure also owns its handle independently
    let ur = Arc::clone(&updated_refs);
    callbacks.update_tips(move |refname, _old, _new| {
        ur.lock().unwrap().push(refname.to_string());
        true
    });

    callbacks
}

fn build_push_callbacks<'a>(
    username: Option<String>,
    token: Option<String>,
    needs_creds: Arc<Mutex<bool>>,
) -> RemoteCallbacks<'a> {
    let mut callbacks = RemoteCallbacks::new();
    let username = username.unwrap_or_default();
    let token = token.unwrap_or_default();

    let nc = Arc::clone(&needs_creds);
    callbacks.credentials(move |_url, username_from_url, _allowed| {
        if token.is_empty() {
            *nc.lock().unwrap() = true;
            Err(git2::Error::from_str("No credentials available"))
        } else {
            let uname = if !username.is_empty() {
                username.clone()
            } else {
                username_from_url.unwrap_or("git").to_string()
            };
            Cred::userpass_plaintext(&uname, &token)
        }
    });

    callbacks
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_remotes(repo_path: String) -> Result<Vec<RemoteInfo>, String> {
    let repo = open(&repo_path)?;
    let remote_names = repo.remotes().map_err(|e| e.message().to_string())?;
    let mut remotes = Vec::new();
    for name in remote_names.iter().flatten() {
        if let Ok(remote) = repo.find_remote(name) {
            remotes.push(RemoteInfo {
                name: name.to_string(),
                url: remote.url().unwrap_or("").to_string(),
                fetch_url: remote.url().map(|s| s.to_string()),
                push_url: remote.pushurl().map(|s| s.to_string()),
            });
        }
    }
    Ok(remotes)
}

#[tauri::command]
pub fn fetch_remote(
    app: tauri::AppHandle,
    repo_path: String,
    remote_name: String,
) -> Result<FetchResult, String> {
    let repo = open(&repo_path)?;
    let mut remote = repo.find_remote(&remote_name).map_err(|e| e.message().to_string())?;
    let url = remote.url().unwrap_or("").to_string();
    let host = extract_host(&url);
    let cred = get_credential_for_host(&app, &host);
    let (username, token) = cred.unzip();

    // Arc<Mutex<>> — closures capture clones, not borrows
    let needs_creds = Arc::new(Mutex::new(false));
    let updated_refs = Arc::new(Mutex::new(Vec::<String>::new()));

    let callbacks = build_fetch_callbacks(
        username,
        token,
        Arc::clone(&needs_creds),
        Arc::clone(&updated_refs),
    );

    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);

    match remote.fetch(&[] as &[&str], Some(&mut fetch_opts), None) {
        Ok(_) => {
            // fetch_opts is dropped here — Arc refcount drops, closures released
            // Now we can safely read the Arc values
            let refs = updated_refs.lock().unwrap().clone();
            Ok(FetchResult {
                success: true,
                needs_credentials: false,
                error: None,
                updated_refs: refs,
            })
        }
        Err(e) => {
            let msg = e.message().to_string();
            let nc = *needs_creds.lock().unwrap();
            let is_auth = nc
                || msg.contains("authentication")
                || msg.contains("credentials")
                || msg.contains("401")
                || msg.contains("403");
            Ok(FetchResult {
                success: false,
                needs_credentials: is_auth,
                error: Some(if is_auth {
                    "Authentication required. Please enter your credentials.".to_string()
                } else {
                    msg
                }),
                updated_refs: vec![],
            })
        }
    }
}

#[tauri::command]
pub fn push_branch(
    app: tauri::AppHandle,
    repo_path: String,
    remote_name: String,
    branch_name: String,
    force: bool,
) -> Result<PushResult, String> {
    let repo = open(&repo_path)?;
    let mut remote = repo.find_remote(&remote_name).map_err(|e| e.message().to_string())?;
    let url = remote.url().unwrap_or("").to_string();
    let host = extract_host(&url);
    let cred = get_credential_for_host(&app, &host);
    let (username, token) = cred.unzip();

    let needs_creds = Arc::new(Mutex::new(false));

    let callbacks = build_push_callbacks(
        username,
        token,
        Arc::clone(&needs_creds),
    );

    let mut push_opts = PushOptions::new();
    push_opts.remote_callbacks(callbacks);

    let refspec = if force {
        format!("+refs/heads/{}:refs/heads/{}", branch_name, branch_name)
    } else {
        format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name)
    };

    match remote.push(&[refspec.as_str()], Some(&mut push_opts)) {
        Ok(_) => Ok(PushResult {
            success: true,
            needs_credentials: false,
            error: None,
            pushed_ref: Some(branch_name),
        }),
        Err(e) => {
            let msg = e.message().to_string();
            let nc = *needs_creds.lock().unwrap();
            let is_auth = nc
                || msg.contains("authentication")
                || msg.contains("credentials")
                || msg.contains("401")
                || msg.contains("403");
            let is_rejected = msg.contains("rejected")
                || msg.contains("non-fast-forward")
                || msg.contains("fetch first");
            Ok(PushResult {
                success: false,
                needs_credentials: is_auth,
                error: Some(if is_auth {
                    "Authentication required. Please enter your credentials.".to_string()
                } else if is_rejected {
                    "Push rejected: remote has changes you don't have locally. Pull first, then push again.".to_string()
                } else {
                    msg
                }),
                pushed_ref: None,
            })
        }
    }
}

#[tauri::command]
pub fn pull_branch(
    app: tauri::AppHandle,
    repo_path: String,
    remote_name: String,
    branch_name: String,
) -> Result<FetchResult, String> {
    let fetch_result = fetch_remote(app, repo_path.clone(), remote_name.clone())?;
    if !fetch_result.success {
        return Ok(fetch_result);
    }

    let repo = open(&repo_path)?;
    let remote_ref = format!("refs/remotes/{}/{}", remote_name, branch_name);

    let remote_oid = match repo.find_reference(&remote_ref) {
        Ok(r) => r.target().ok_or("Remote ref has no target")?,
        Err(_) => {
            return Ok(FetchResult {
                success: true,
                needs_credentials: false,
                error: None,
                updated_refs: fetch_result.updated_refs,
            });
        }
    };

    let remote_annotated = repo.find_annotated_commit(remote_oid).map_err(|e| e.message().to_string())?;
    let analysis = repo.merge_analysis(&[&remote_annotated]).map_err(|e| e.message().to_string())?;

    if analysis.0.is_up_to_date() {
        return Ok(FetchResult {
            success: true,
            needs_credentials: false,
            error: None,
            updated_refs: vec!["Already up to date".to_string()],
        });
    }

    if analysis.0.is_fast_forward() {
        let mut reference = repo
            .find_reference(&format!("refs/heads/{}", branch_name))
            .map_err(|e| e.message().to_string())?;
        reference.set_target(remote_oid, "pull: fast-forward").map_err(|e| e.message().to_string())?;
        let mut checkout = git2::build::CheckoutBuilder::new();
        checkout.force();
        repo.checkout_head(Some(&mut checkout)).map_err(|e| e.message().to_string())?;

        Ok(FetchResult {
            success: true,
            needs_credentials: false,
            error: None,
            updated_refs: vec![format!("Fast-forwarded {} to latest", branch_name)],
        })
    } else {
        Ok(FetchResult {
            success: false,
            needs_credentials: false,
            error: Some(
                "Cannot fast-forward: your branch has diverged from remote. \
                 Commit or stash your changes, then pull again.".to_string(),
            ),
            updated_refs: vec![],
        })
    }
}

#[tauri::command]
pub fn save_credential(
    app: tauri::AppHandle,
    host: String,
    username: String,
    token: String,
) -> Result<(), String> {
    let mut creds = load_credentials(&app);
    creds.retain(|c| c["host"].as_str() != Some(&host));
    // Store token as plain text — file is in user-private app data directory
    creds.push(serde_json::json!({ "host": host, "username": username, "token": token }));
    save_credentials(&app, &creds);
    Ok(())
}

#[tauri::command]
pub fn delete_credential(app: tauri::AppHandle, host: String) -> Result<(), String> {
    let mut creds = load_credentials(&app);
    creds.retain(|c| c["host"].as_str() != Some(&host));
    save_credentials(&app, &creds);
    Ok(())
}

#[tauri::command]
pub fn get_stored_credentials(app: tauri::AppHandle) -> Result<Vec<StoredCredential>, String> {
    let creds = load_credentials(&app);
    Ok(creds.iter().filter_map(|c| Some(StoredCredential {
        host: c["host"].as_str()?.to_string(),
        username: c["username"].as_str()?.to_string(),
    })).collect())
}

/// debug_credential — returns the stored token for a host in plain text.
/// ONLY use during development to verify credentials are saved correctly.
/// Remove before shipping.
#[tauri::command]
pub fn debug_credential(app: tauri::AppHandle, host: String) -> String {
    match get_credential_for_host(&app, &host) {
        Some((username, token)) => format!(
            "username='{}' token_len={} token_first10='{}'",
            username,
            token.len(),
            &token[..token.len().min(10)]
        ),
        None => format!("No credential found for host '{}'", host),
    }
}