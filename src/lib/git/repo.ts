import { invoke } from '@tauri-apps/api/core';
import type { Repository, UserSettings } from '../../types';

// open_repo: validates path is a git repo, returns Repository metadata
export async function openRepo(path: string): Promise<Repository> {
  return invoke<Repository>('open_repo', { path });
}

// get_recent_repos: reads the saved list from app data dir
export async function getRecentRepos(): Promise<Repository[]> {
  return invoke<Repository[]>('get_recent_repos');
}

// save_recent_repo: persists a repo to the recent list
// Rust expects the full repo object serialized
export async function saveRecentRepo(repo: Repository): Promise<void> {
  return invoke<void>('save_recent_repo', { repo });
}

// remove_recent_repo: removes a repo from the recent list by path
export async function removeRecentRepo(path: string): Promise<void> {
  return invoke<void>('remove_recent_repo', { path });
}

// get_repo_status: returns isDirty, ahead/behind counts, current branch
export async function getRepoStatus(
  path: string,
): Promise<Pick<Repository, 'isDirty' | 'aheadCount' | 'behindCount' | 'currentBranch'>> {
  return invoke('get_repo_status', { path });
}

// get_settings: reads UserSettings from app config file
export async function getSettings(): Promise<UserSettings> {
  return invoke<UserSettings>('get_settings');
}

// save_settings: writes UserSettings to app config file
export async function saveSettings(settings: UserSettings): Promise<void> {
  return invoke<void>('save_settings', { settings });
}

// init_repo: creates a new empty git repo at the given path
// Returns a status string (not a Repository) since there are no commits yet
export async function initRepo(path: string): Promise<string> {
  return invoke<string>('init_repo', { path });
}

// clone_repo: clones a remote URL to a local path, returns Repository
export async function cloneRepo(url: string, localPath: string): Promise<Repository> {
  return invoke<Repository>('clone_repo', { url, localPath });
}