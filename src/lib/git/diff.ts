import { invoke } from '@tauri-apps/api/core';
import type { FileChange, TreeNode } from '../../types';

// get_file_diff: unstaged diff for a working-tree file
export async function getFileDiff(
  repoPath: string,
  filePath: string,
): Promise<FileChange> {
  return invoke<FileChange>('get_file_diff', { repoPath, filePath });
}

// get_staged_diff: diff of staged changes (index vs HEAD)
export async function getStagedDiff(
  repoPath: string,
  filePath: string,
): Promise<FileChange> {
  return invoke<FileChange>('get_staged_diff', { repoPath, filePath });
}

// get_commit_diff: all file changes introduced by a specific commit
export async function getCommitDiff(
  repoPath: string,
  oid: string,
): Promise<FileChange[]> {
  return invoke<FileChange[]>('get_commit_diff', { repoPath, oid });
}

// get_file_tree: returns the directory tree for the working dir
// statusMap: path -> statusKind so the tree can show dirty indicators
export async function getFileTree(repoPath: string): Promise<TreeNode[]> {
  return invoke<TreeNode[]>('get_file_tree', { repoPath });
}

// get_file_content: raw text content of a file at HEAD or working tree
export async function getFileContent(
  repoPath: string,
  filePath: string,
  ref = 'WORKDIR',
): Promise<string> {
  return invoke<string>('get_file_content', { repoPath, filePath, refName: ref });
}