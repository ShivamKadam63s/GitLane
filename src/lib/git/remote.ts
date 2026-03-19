import { invoke } from '@tauri-apps/api/core';

export interface RemoteInfo {
  name: string;
  url: string;
  fetchUrl?: string;
  pushUrl?: string;
}

export interface PushResult {
  success: boolean;
  needsCredentials: boolean;
  error?: string;
  pushedRef?: string;
}

export interface FetchResult {
  success: boolean;
  needsCredentials: boolean;
  error?: string;
  updatedRefs: string[];
}

export interface StoredCredential {
  host: string;
  username: string;
}

export function getRemotes(repoPath: string): Promise<RemoteInfo[]> {
  return invoke('get_remotes', { repoPath });
}

export function fetchRemote(
  repoPath: string,
  remoteName = 'origin',
): Promise<FetchResult> {
  return invoke('fetch_remote', { repoPath, remoteName });
}

export function pushBranch(
  repoPath: string,
  remoteName = 'origin',
  branchName: string,
  force = false,
): Promise<PushResult> {
  return invoke('push_branch', { repoPath, remoteName, branchName, force });
}

export function pullBranch(
  repoPath: string,
  remoteName = 'origin',
  branchName: string,
): Promise<FetchResult> {
  return invoke('pull_branch', { repoPath, remoteName, branchName });
}

export function saveCredential(
  host: string,
  username: string,
  token: string,
): Promise<void> {
  return invoke('save_credential', { host, username, token });
}

export function deleteCredential(host: string): Promise<void> {
  return invoke('delete_credential', { host });
}

export function getStoredCredentials(): Promise<StoredCredential[]> {
  return invoke('get_stored_credentials');
}

// Extract hostname from a remote URL (same logic as Rust side)
export function extractHost(url: string): string {
  if (url.startsWith('git@')) {
    return url.replace('git@', '').split(':')[0] ?? url;
  }
  return url.split('://')[1]?.split('/')[0] ?? url;
}