import { invoke } from '@tauri-apps/api/core';
import type { Branch, CommitSummary } from '../../types';

// get_branches: returns all local + remote branches
export async function getBranches(repoPath: string): Promise<Branch[]> {
  return invoke<Branch[]>('get_branches', { repoPath });
}

// create_branch: creates a new branch from a given ref (default HEAD)
export async function createBranch(
  repoPath: string,
  name: string,
  fromRef = 'HEAD',
): Promise<Branch> {
  return invoke<Branch>('create_branch', { repoPath, name, fromRef });
}

// switch_branch: checkout an existing branch
// returns { conflicts: string[] } if there are blocking conflicts
export async function switchBranch(
  repoPath: string,
  name: string,
): Promise<{ conflicts: string[] }> {
  return invoke('switch_branch', { repoPath, name });
}

// delete_branch: deletes a local branch (force=true skips merge check)
export async function deleteBranch(
  repoPath: string,
  name: string,
  force = false,
): Promise<void> {
  return invoke<void>('delete_branch', { repoPath, name, force });
}

// merge_branch: merges `sourceBranch` into current HEAD
// returns conflict file list if merge fails cleanly
export async function mergeBranch(
  repoPath: string,
  sourceBranch: string,
): Promise<{ conflicts: string[] }> {
  return invoke('merge_branch', { repoPath, sourceBranch });
}

// rename_branch: renames a local branch
export async function renameBranch(
  repoPath: string,
  oldName: string,
  newName: string,
): Promise<void> {
  return invoke<void>('rename_branch', { repoPath, oldName, newName });
}

// get_branch_log: commit log scoped to a specific branch
export async function getBranchLog(
  repoPath: string,
  branchName: string,
  limit = 50,
): Promise<CommitSummary[]> {
  return invoke<CommitSummary[]>('get_branch_log', { repoPath, branchName, limit });
}