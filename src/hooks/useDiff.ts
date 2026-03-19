import { useState, useEffect } from 'react';
import { getFileDiff, getStagedDiff } from '../lib/git/diff';
import type { FileChange } from '../types';

/**
 * useDiff — fetches the diff for a single file.
 *
 * Fix for diff view locking bug:
 * - diff is reset to null IMMEDIATELY when filePath changes, before the fetch
 *   starts. This clears the stale previous file diff from the screen instantly.
 * - isLoading is reset in the cleanup function so it can never get permanently
 *   stuck at true when switching files quickly (race condition fix).
 */
export function useDiff(
  repoPath: string | null,
  filePath: string | null,
  staged = false,
) {
  const [diff, setDiff] = useState<FileChange | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Critical fix: clear previous diff IMMEDIATELY when path changes.
    // Without this, the old file's diff stays on screen while the new one
    // loads. If the new load gets cancelled, the stale diff never clears,
    // locking the view permanently.
    setDiff(null);
    setError(null);

    if (!repoPath || !filePath) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const request = staged
      ? getStagedDiff(repoPath, filePath)
      : getFileDiff(repoPath, filePath);

    request
      .then((data) => {
        if (!cancelled) {
          setDiff(data);
          setIsLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message ?? String(e));
          setIsLoading(false);
        }
      });

    return () => {
      // Reset isLoading here too — not just cancelled.
      // Without this, switching files quickly leaves isLoading=true
      // permanently because the cleanup runs BEFORE the new .then() fires,
      // and the new effect's setIsLoading(true) fires but its .then() sets
      // it back to false while the OLD cleanup already set cancelled=true
      // on the in-flight request, meaning setIsLoading(false) inside .then()
      // is guarded by `if (!cancelled)` and never runs.
      cancelled = true;
      setIsLoading(false);
    };
  }, [repoPath, filePath, staged]);

  return { diff, isLoading, error };
}