import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Repository, FileStatus, Branch, CommitSummary } from '../types';
import type { TreeNode } from '../types';
import { getRecentRepos, getRepoStatus, saveRecentRepo, removeRecentRepo } from '../lib/git';

interface RepoState {
  // ── Repo list ──────────────────────────────────────────────────────────────
  repos: Repository[];
  loadRepos: () => Promise<void>;
  addRepo: (repo: Repository) => Promise<void>;
  removeRepo: (path: string) => Promise<void>;

  // ── Active repo ────────────────────────────────────────────────────────────
  activeRepo: Repository | null;
  setActiveRepo: (repo: Repository | null) => void;
  refreshActiveRepo: () => Promise<void>;

  // ── Live working tree data ─────────────────────────────────────────────────
  fileStatuses: FileStatus[];
  setFileStatuses: (statuses: FileStatus[]) => void;

  // fileTree is now in the store (not local state in RepoDetailPage)
  // This lets useRepo.refresh() update it alongside commits/branches
  fileTree: TreeNode[];
  setFileTree: (tree: TreeNode[]) => void;

  branches: Branch[];
  setBranches: (branches: Branch[]) => void;

  recentCommits: CommitSummary[];
  setRecentCommits: (commits: CommitSummary[]) => void;

  // ── Loading / error ────────────────────────────────────────────────────────
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
}

export const useRepoStore = create<RepoState>()(
  persist(
    (set, get) => ({
      repos: [],
      activeRepo: null,
      fileStatuses: [],
      fileTree: [],
      branches: [],
      recentCommits: [],
      isLoading: false,
      error: null,

      loadRepos: async () => {
        set({ isLoading: true, error: null });
        try {
          const repos = await getRecentRepos();
          set({ repos, isLoading: false });
        } catch (e: any) {
          set({ isLoading: false, error: e.message ?? 'Failed to load repos' });
        }
      },

      addRepo: async (repo) => {
        await saveRecentRepo(repo);
        set((s) => ({
          repos: [repo, ...s.repos.filter((r) => r.path !== repo.path)],
        }));
      },

      removeRepo: async (path) => {
        await removeRecentRepo(path);
        set((s) => ({
          repos: s.repos.filter((r) => r.path !== path),
          activeRepo: s.activeRepo?.path === path ? null : s.activeRepo,
        }));
      },

      setActiveRepo: (repo) => set({
        activeRepo: repo,
        // Reset live data when switching repos so stale data never shows
        fileStatuses: [],
        fileTree: [],
        branches: [],
        recentCommits: [],
        error: null,
      }),

      refreshActiveRepo: async () => {
        const { activeRepo } = get();
        if (!activeRepo) return;
        try {
          const status = await getRepoStatus(activeRepo.path);
          set((s) => ({
            activeRepo: s.activeRepo ? { ...s.activeRepo, ...status } : null,
          }));
        } catch (e: any) {
          set({ error: e.message });
        }
      },

      setFileStatuses: (fileStatuses) => set({ fileStatuses }),
      setFileTree: (fileTree) => set({ fileTree }),
      setBranches: (branches) => set({ branches }),
      setRecentCommits: (recentCommits) => set({ recentCommits }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'gitlane-repos',
      partialize: (s) => ({
        repos: s.repos,
        activeRepo: s.activeRepo
          ? { ...s.activeRepo, isDirty: false, aheadCount: 0, behindCount: 0 }
          : null,
      }),
    },
  ),
);