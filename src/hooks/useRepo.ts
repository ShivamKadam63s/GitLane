import { useEffect, useCallback, useRef } from 'react';
import { useRepoStore } from '../store/repoStore';
import { getStatus, getCommitLog } from '../lib/git/commits';
import { getBranches } from '../lib/git/branches';
import { getFileTree } from '../lib/git/diff';

/**
 * useRepo — single source of truth for all live repo data.
 *
 * Fixes applied:
 * 1. fileTree is now fetched HERE so refresh() updates everything atomically.
 *    Previously fileTree was fetched separately in RepoDetailPage and never
 *    refreshed after commits or external file changes.
 * 2. Auto-polls every 3s while window is focused — detects VS Code edits
 *    without requiring manual navigation away and back.
 * 3. useCommitLog is now driven by repoStore.recentCommits so commits appear
 *    immediately after committing without page navigation.
 */
export function useRepo() {
  const activeRepo = useRepoStore((s) => s.activeRepo);
  const setFileStatuses = useRepoStore((s) => s.setFileStatuses);
  const setBranches = useRepoStore((s) => s.setBranches);
  const setRecentCommits = useRepoStore((s) => s.setRecentCommits);
  const setFileTree = useRepoStore((s) => s.setFileTree);
  const setError = useRepoStore((s) => s.setError);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!activeRepo) return;

    const [statusResult, branchesResult, commitsResult, treeResult] =
      await Promise.allSettled([
        getStatus(activeRepo.path),
        getBranches(activeRepo.path),
        getCommitLog(activeRepo.path, 100),
        getFileTree(activeRepo.path),
      ]);

    if (statusResult.status === 'fulfilled') {
      setFileStatuses(statusResult.value);
    } else {
      console.error('[useRepo] get_status failed:', statusResult.reason);
    }
    if (branchesResult.status === 'fulfilled') {
      setBranches(branchesResult.value);
    } else {
      console.error('[useRepo] get_branches failed:', branchesResult.reason);
    }
    if (commitsResult.status === 'fulfilled') {
      setRecentCommits(commitsResult.value);
    } else {
      console.error('[useRepo] get_commit_log failed:', commitsResult.reason);
      setError(String(commitsResult.reason));
    }
    if (treeResult.status === 'fulfilled') {
      setFileTree(treeResult.value);
    } else {
      console.error('[useRepo] get_file_tree failed:', treeResult.reason);
    }
  }, [activeRepo, setFileStatuses, setBranches, setRecentCommits, setFileTree, setError]);

  // Initial load when repo changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-poll every 3s, only while window is focused (saves CPU when idle)
  useEffect(() => {
    if (!activeRepo) return;

    const startPoll = () => {
      if (pollRef.current) return; // already polling
      pollRef.current = setInterval(refresh, 3000);
    };
    const stopPoll = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    if (document.hasFocus()) startPoll();
    window.addEventListener('focus', startPoll);
    window.addEventListener('blur', stopPoll);

    return () => {
      stopPoll();
      window.removeEventListener('focus', startPoll);
      window.removeEventListener('blur', stopPoll);
    };
  }, [activeRepo, refresh]);

  return { refresh };
}