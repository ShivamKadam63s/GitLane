import { invoke } from '@tauri-apps/api/core';
import type { CommitSummary, CommitDetail, FileStatus } from '../../types';

// get_commit_log: returns last `limit` commits from refName (default HEAD)
// IMPORTANT: must use `refName` not `ref` — Tauri maps camelCase to snake_case (refName → ref_name)
export async function getCommitLog(
  repoPath: string,
  limit = 100,
  refName = 'HEAD',
): Promise<CommitSummary[]> {
  return invoke<CommitSummary[]>('get_commit_log', { repoPath, limit, refName });
}

// get_commit_detail: returns full commit info including file changes
export async function getCommitDetail(
  repoPath: string,
  oid: string,
): Promise<CommitDetail> {
  return invoke<CommitDetail>('get_commit_detail', { repoPath, oid });
}

// get_status: returns every changed file in working tree + index
export async function getStatus(repoPath: string): Promise<FileStatus[]> {
  return invoke<FileStatus[]>('get_status', { repoPath });
}

// stage_file: git add <path>
export async function stageFile(repoPath: string, filePath: string): Promise<void> {
  return invoke<void>('stage_file', { repoPath, filePath });
}

// unstage_file: git restore --staged <path>
export async function unstageFile(repoPath: string, filePath: string): Promise<void> {
  return invoke<void>('unstage_file', { repoPath, filePath });
}

// stage_all: git add -A
export async function stageAll(repoPath: string): Promise<void> {
  return invoke<void>('stage_all', { repoPath });
}

// create_commit: creates a commit with everything currently staged
export async function createCommit(
  repoPath: string,
  message: string,
  authorName: string,
  authorEmail: string,
): Promise<CommitSummary> {
  return invoke<CommitSummary>('create_commit', {
    repoPath,
    message,
    authorName,
    authorEmail,
  });
}

// discard_file: git checkout -- <path>  (WARNING: destroys local changes)
export async function discardFile(repoPath: string, filePath: string): Promise<void> {
  return invoke<void>('discard_file', { repoPath, filePath });
}

// stash_push: git stash push -m <message>
export async function stashPush(repoPath: string, message?: string): Promise<void> {
  return invoke<void>('stash_push', { repoPath, message });
}

// stash_pop: git stash pop
export async function stashPop(repoPath: string): Promise<void> {
  return invoke<void>('stash_pop', { repoPath });
}