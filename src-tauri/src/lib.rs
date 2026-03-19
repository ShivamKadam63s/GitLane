mod commands;

use commands::{git, branch, diff, repo, remote};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // ── git.rs ──────────────────────────────────────────────────────
            git::init_repo,
            git::get_status,
            git::stage_file,
            git::unstage_file,
            git::stage_all,
            git::create_commit,
            git::get_commit_log,
            git::get_commit_detail,
            git::discard_file,
            git::stash_push,
            git::stash_pop,
            git::revert_commit,
            // ── branch.rs ───────────────────────────────────────────────────
            branch::get_branches,
            branch::create_branch,
            branch::switch_branch,
            branch::delete_branch,
            branch::merge_branch,
            branch::rename_branch,
            branch::get_branch_log,
            // ── diff.rs ─────────────────────────────────────────────────────
            diff::get_file_diff,
            diff::get_staged_diff,
            diff::get_commit_diff,
            diff::get_file_tree,
            diff::get_file_content,
            // ── repo.rs ─────────────────────────────────────────────────────
            repo::open_repo,
            repo::get_repo_status,
            repo::get_recent_repos,
            repo::save_recent_repo,
            repo::remove_recent_repo,
            repo::get_settings,
            repo::save_settings,
            repo::clone_repo,
            // ── remote.rs ───────────────────────────────────────────────────
            remote::get_remotes,
            remote::fetch_remote,
            remote::push_branch,
            remote::pull_branch,
            remote::save_credential,
            remote::delete_credential,
            remote::get_stored_credentials,
            remote::debug_credential,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}