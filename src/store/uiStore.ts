import { create } from 'zustand';

export type RepoTab = 'files' | 'history' | 'branches';
export type PanelId = 'commit' | 'clone' | 'newBranch' | 'settings' | null;

interface UiState {
  // ── Repo detail tabs ───────────────────────────────────────────────────────
  activeTab: RepoTab;
  setActiveTab: (tab: RepoTab) => void;

  // ── Selected items ─────────────────────────────────────────────────────────
  selectedFilePath: string | null;
  setSelectedFilePath: (path: string | null) => void;

  selectedCommitOid: string | null;
  setSelectedCommitOid: (oid: string | null) => void;

  selectedBranchName: string | null;
  setSelectedBranchName: (name: string | null) => void;

  // ── Sidebar ────────────────────────────────────────────────────────────────
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // ── Modal / panel ──────────────────────────────────────────────────────────
  openPanel: PanelId;
  setOpenPanel: (panel: PanelId) => void;

  // ── Commit message draft (persisted while panel is open) ───────────────────
  commitMessageDraft: string;
  setCommitMessageDraft: (msg: string) => void;

  // ── Search ─────────────────────────────────────────────────────────────────
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  activeTab: 'files',
  setActiveTab: (activeTab) => set({ activeTab }),

  selectedFilePath: null,
  setSelectedFilePath: (selectedFilePath) => set({ selectedFilePath }),

  selectedCommitOid: null,
  setSelectedCommitOid: (selectedCommitOid) => set({ selectedCommitOid }),

  selectedBranchName: null,
  setSelectedBranchName: (selectedBranchName) => set({ selectedBranchName }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  openPanel: null,
  setOpenPanel: (openPanel) => set({ openPanel }),

  commitMessageDraft: '',
  setCommitMessageDraft: (commitMessageDraft) => set({ commitMessageDraft }),

  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));