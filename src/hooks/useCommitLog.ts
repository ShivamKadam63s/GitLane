import { useState, useEffect, useCallback } from 'react';
import { getCommitLog } from '../lib/git/commits';
import type { CommitSummary } from '../types';

const PAGE_SIZE = 50;

/**
 * useCommitLog — paginated commit history for a repo/branch.
 * Uses refName (not ref) to correctly map to Rust's ref_name parameter.
 */
export function useCommitLog(repoPath: string | null, refName = 'HEAD') {
  const [commits, setCommits] = useState<CommitSummary[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when repo or ref changes
  useEffect(() => {
    setCommits([]);
    setPage(1);
    setHasMore(true);
    setError(null);
  }, [repoPath, refName]);

  // Fetch current page
  useEffect(() => {
    if (!repoPath) return;

    let cancelled = false;
    setIsLoading(true);

    getCommitLog(repoPath, page * PAGE_SIZE, refName)
      .then((data) => {
        if (cancelled) return;
        setCommits(data);
        setHasMore(data.length === page * PAGE_SIZE);
        setIsLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(String(e));
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [repoPath, refName, page]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) setPage((p) => p + 1);
  }, [isLoading, hasMore]);

  return { commits, isLoading, error, hasMore, loadMore };
}