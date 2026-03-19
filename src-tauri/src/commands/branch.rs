use git2::{Repository, BranchType};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Branch {
    pub name: String,
    pub kind: String,      // "local" | "remote"
    pub is_current: bool,
    pub is_head: bool,
    pub tip_oid: String,
    pub ahead_count: usize,
    pub behind_count: usize,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SwitchResult {
    pub conflicts: Vec<String>,
}

fn open(path: &str) -> Result<Repository, String> {
    Repository::open(path).map_err(|e| e.message().to_string())
}

/// get_branches — list all local and remote branches
#[tauri::command]
pub fn get_branches(repo_path: String) -> Result<Vec<Branch>, String> {
    let repo = open(&repo_path)?;
    let head_oid = repo.head().ok().and_then(|h| h.target());
    let mut branches = Vec::new();

    // Local branches
    let local = repo.branches(Some(BranchType::Local))
        .map_err(|e| e.message().to_string())?;

    for item in local {
        let (branch, _) = item.map_err(|e| e.message().to_string())?;
        let name = branch.name().map_err(|e| e.message().to_string())?
            .unwrap_or("").to_string();
        let is_current = branch.is_head();
        let tip = branch.get().target().unwrap_or(git2::Oid::zero());
        let is_head = Some(tip) == head_oid;

        // Ahead/behind vs upstream
        let (ahead, behind) = branch.upstream().ok()
            .and_then(|upstream| {
                let upstream_oid = upstream.get().target()?;
                repo.graph_ahead_behind(tip, upstream_oid).ok()
            })
            .unwrap_or((0, 0));

        branches.push(Branch {
            name,
            kind: "local".to_string(),
            is_current,
            is_head,
            tip_oid: tip.to_string(),
            ahead_count: ahead,
            behind_count: behind,
        });
    }

    // Remote branches
    let remote = repo.branches(Some(BranchType::Remote))
        .map_err(|e| e.message().to_string())?;

    for item in remote {
        let (branch, _) = item.map_err(|e| e.message().to_string())?;
        let name = branch.name().map_err(|e| e.message().to_string())?
            .unwrap_or("").to_string();
        let tip = branch.get().target().unwrap_or(git2::Oid::zero());

        branches.push(Branch {
            name,
            kind: "remote".to_string(),
            is_current: false,
            is_head: false,
            tip_oid: tip.to_string(),
            ahead_count: 0,
            behind_count: 0,
        });
    }

    Ok(branches)
}

/// create_branch — create a new branch from a ref
#[tauri::command]
pub fn create_branch(
    repo_path: String,
    name: String,
    from_ref: String,
) -> Result<Branch, String> {
    let repo = open(&repo_path)?;
    let obj = repo.revparse_single(&from_ref)
        .map_err(|e| e.message().to_string())?;
    let commit = obj.peel_to_commit()
        .map_err(|e| e.message().to_string())?;

    let branch = repo.branch(&name, &commit, false)
        .map_err(|e| e.message().to_string())?;

    let tip = branch.get().target().unwrap_or(git2::Oid::zero());

    Ok(Branch {
        name,
        kind: "local".to_string(),
        is_current: false,
        is_head: false,
        tip_oid: tip.to_string(),
        ahead_count: 0,
        behind_count: 0,
    })
}

/// switch_branch — checkout a branch
#[tauri::command]
pub fn switch_branch(repo_path: String, name: String) -> Result<SwitchResult, String> {
    let repo = open(&repo_path)?;

    // Check for conflicts first
    let mut status_opts = git2::StatusOptions::new();
    status_opts.include_untracked(false);
    let statuses = repo.statuses(Some(&mut status_opts))
        .map_err(|e| e.message().to_string())?;

    let conflicts: Vec<String> = statuses.iter()
        .filter(|s| s.status().contains(git2::Status::CONFLICTED))
        .filter_map(|s| s.path().map(|p| p.to_string()))
        .collect();

    if !conflicts.is_empty() {
        return Ok(SwitchResult { conflicts });
    }

    // Find the branch tip
    let branch = repo.find_branch(&name, BranchType::Local)
        .map_err(|e| e.message().to_string())?;
    let obj = branch.get().peel_to_commit()
        .map_err(|e| e.message().to_string())?;

    // Set HEAD to the branch
    repo.set_head(&format!("refs/heads/{}", name))
        .map_err(|e| e.message().to_string())?;

    // Update working tree
    let mut checkout_builder = git2::build::CheckoutBuilder::new();
    checkout_builder.safe();
    repo.checkout_tree(obj.as_object(), Some(&mut checkout_builder))
        .map_err(|e| e.message().to_string())?;

    Ok(SwitchResult { conflicts: vec![] })
}

/// delete_branch — delete a local branch
#[tauri::command]
pub fn delete_branch(repo_path: String, name: String, force: bool) -> Result<(), String> {
    let repo = open(&repo_path)?;
    let mut branch = repo.find_branch(&name, BranchType::Local)
        .map_err(|e| e.message().to_string())?;

    if branch.is_head() {
        return Err("Cannot delete the currently checked out branch".to_string());
    }

    branch.delete().map_err(|e| e.message().to_string())?;
    let _ = force; // force flag for future use
    Ok(())
}

/// merge_branch — merge source_branch into HEAD
#[tauri::command]
pub fn merge_branch(
    repo_path: String,
    source_branch: String,
) -> Result<SwitchResult, String> {
    let repo = open(&repo_path)?;

    let annotated = {
        let branch = repo.find_branch(&source_branch, BranchType::Local)
            .map_err(|e| e.message().to_string())?;
        let oid = branch.get().target()
            .ok_or("Branch has no target")?;
        repo.find_annotated_commit(oid)
            .map_err(|e| e.message().to_string())?
    };

    let analysis = repo.merge_analysis(&[&annotated])
        .map_err(|e| e.message().to_string())?;

    if analysis.0.is_up_to_date() {
        return Ok(SwitchResult { conflicts: vec![] });
    }

    if analysis.0.is_fast_forward() {
        // Fast-forward: just advance HEAD
        let mut reference = repo.head().map_err(|e| e.message().to_string())?;
        reference.set_target(annotated.id(), "fast-forward merge")
            .map_err(|e| e.message().to_string())?;
        let mut checkout = git2::build::CheckoutBuilder::new();
        checkout.force();
        repo.checkout_head(Some(&mut checkout))
            .map_err(|e| e.message().to_string())?;
        return Ok(SwitchResult { conflicts: vec![] });
    }

    // Real merge
    let mut merge_opts = git2::MergeOptions::new();
    repo.merge(&[&annotated], Some(&mut merge_opts), None)
        .map_err(|e| e.message().to_string())?;

    // Collect conflicts
    let index = repo.index().map_err(|e| e.message().to_string())?;
    if index.has_conflicts() {
        let conflicts: Vec<String> = index.conflicts()
            .map_err(|e| e.message().to_string())?
            .filter_map(|c| c.ok())
            .filter_map(|c| c.our.and_then(|e| String::from_utf8(e.path).ok()))
            .collect();
        return Ok(SwitchResult { conflicts });
    }

    Ok(SwitchResult { conflicts: vec![] })
}

/// rename_branch — rename a local branch
#[tauri::command]
pub fn rename_branch(
    repo_path: String,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    let repo = open(&repo_path)?;
    let mut branch = repo.find_branch(&old_name, BranchType::Local)
        .map_err(|e| e.message().to_string())?;
    branch.rename(&new_name, false)
        .map_err(|e| e.message().to_string())?;
    Ok(())
}

/// get_branch_log — commit log scoped to a specific branch
#[tauri::command]
pub fn get_branch_log(
    repo_path: String,
    branch_name: String,
    limit: usize,
) -> Result<Vec<crate::commands::git::CommitSummary>, String> {
    crate::commands::git::get_commit_log(repo_path, limit, branch_name)
}