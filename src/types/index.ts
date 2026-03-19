// ─── Repository ───────────────────────────────────────────────────────────────
// Field names must EXACTLY match the camelCase keys Rust serializes via serde

export interface Repository {
  id: string;           // deterministic hash of path
  path: string;         // absolute path on disk
  name: string;         // last segment of path
  description?: string;
  currentBranch: string;
  isDirty: boolean;
  aheadCount: number;
  behindCount: number;
  lastCommit?: CommitSummary;
  addedAt: number;      // unix ms timestamp
}

// ─── Commits ──────────────────────────────────────────────────────────────────

export interface CommitSummary {
  oid: string;          // full 40-char SHA
  shortOid: string;     // first 7 chars
  message: string;      // first line only
  authorName: string;
  authorEmail: string;
  timestamp: number;    // unix seconds
  parentOids: string[];
}

export interface CommitDetail extends CommitSummary {
  body: string;         // everything after the first line
  files: FileChange[];  // files changed in this commit
}

// ─── Branches ─────────────────────────────────────────────────────────────────

export type BranchKind = 'local' | 'remote';

export interface Branch {
  name: string;
  kind: BranchKind;
  isCurrent: boolean;
  isHead: boolean;
  tipOid: string;
  aheadCount: number;
  behindCount: number;
  lastCommit?: CommitSummary;
}

// ─── File Status ──────────────────────────────────────────────────────────────

export type FileStatusKind =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'conflicted';

export interface FileStatus {
  path: string;
  oldPath?: string;     // populated when kind === 'renamed'
  kind: FileStatusKind;
  isStaged: boolean;
  isUnstaged: boolean;
}

// ─── File Tree ────────────────────────────────────────────────────────────────

export type TreeNodeKind = 'file' | 'directory';

export interface TreeNode {
  name: string;
  path: string;         // relative to repo root
  kind: TreeNodeKind;
  children?: TreeNode[];
  statusKind?: FileStatusKind; // undefined = clean
}

// ─── Diff / Hunks ─────────────────────────────────────────────────────────────

export type HunkLineKind = 'context' | 'addition' | 'deletion';

export interface HunkLine {
  kind: HunkLineKind;
  content: string;      // the line text, without the +/- prefix
  oldLineNo?: number;
  newLineNo?: number;
}

export interface Hunk {
  header: string;       // e.g. "@@ -10,6 +10,8 @@"
  lines: HunkLine[];
}

export interface FileChange {
  path: string;
  oldPath?: string;
  kind: FileStatusKind;
  hunks: Hunk[];
  isBinary: boolean;
}

// ─── Graph ────────────────────────────────────────────────────────────────────

export interface GraphNode {
  commit: CommitSummary;
  lane: number;         // column index in the graph (0-based)
  color: string;        // hex color for this branch lane
  parents: GraphEdge[];
}

export interface GraphEdge {
  fromLane: number;
  toLane: number;
  toIndex: number;      // row index of the parent commit
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface UserSettings {
  authorName: string;
  authorEmail: string;
  theme: 'dark' | 'light' | 'system';
  defaultBranch: string;
  fetchOnOpen: boolean;
  showHiddenFiles: boolean;
}

// ─── Tauri command result wrapper ─────────────────────────────────────────────

export interface GitResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}