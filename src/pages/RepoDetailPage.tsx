import React, { useEffect, useState } from 'react';
import { confirm } from '@tauri-apps/plugin-dialog';
import { useRepoStore } from '../store/repoStore';
import { useUiStore, RepoTab } from '../store/uiStore';
import { useRepo } from '../hooks/useRepo';
import { useCommitLog } from '../hooks/useCommitLog';
import { useDiff } from '../hooks/useDiff';
import { FileTree } from '../components/FileTree';
import { DiffViewer } from '../components/DiffViewer';
import { CommitList } from '../components/CommitList';
import { CommitGraph } from '../components/CommitGraph';
import { BranchList } from '../components/BranchList';
import { getFileTree } from '../lib/git/diff';
import { stageFile, unstageFile, stageAll, createCommit, discardFile } from '../lib/git/commits';
import { switchBranch, createBranch, deleteBranch } from '../lib/git/branches';
import type { TreeNode, FileStatus } from '../types';
import { CommitDetailPanel } from '../components/CommitDetailPanel';
import { invoke } from '@tauri-apps/api/core';

// ── Commit panel (right side of Files tab) ────────────────────────────────────
function CommitPanel({
  repoPath,
  stagedFiles,
  unstagedFiles,
  onStage,
  onUnstage,
  onStageAll,
  onDiscard,
  onCommit,
}: {
  repoPath: string;
  stagedFiles: FileStatus[];
  unstagedFiles: FileStatus[];
  onStage: (path: string) => void;
  onUnstage: (path: string) => void;
  onStageAll: () => void;
  onDiscard: (path: string) => void;
  onCommit: (message: string) => void;
}) {
  const [message, setMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);

  const handleCommit = async () => {
    if (!message.trim()) return;
    setIsCommitting(true);
    try {
      await onCommit(message.trim());
      setMessage('');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div
      style={{
        width: 240,
        borderLeft: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        background: '#0b1120',
      }}
    >
      {/* Staged files */}
      <div style={sectionHeaderStyle}>
        <span>Staged ({stagedFiles.length})</span>
        {unstagedFiles.length > 0 && (
          <button onClick={onStageAll} style={tinyBtnStyle}>
            Stage all
          </button>
        )}
      </div>
      <div style={{ overflowY: 'auto', maxHeight: 150 }}>
        {stagedFiles.length === 0 ? (
          <div style={emptyHintStyle}>No staged changes</div>
        ) : (
          stagedFiles.map((f) => (
            <FileStatusRow
              key={f.path}
              file={f}
              action="unstage"
              onAction={() => onUnstage(f.path)}
            />
          ))
        )}
      </div>

      {/* Unstaged files */}
      <div style={{ ...sectionHeaderStyle, marginTop: 4 }}>
        <span>Changes ({unstagedFiles.length})</span>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {unstagedFiles.length === 0 ? (
          <div style={{ padding: '12px 10px' }}>
            <div style={emptyHintStyle}>Working tree clean</div>
            <div style={{
              marginTop: 8,
              padding: '10px',
              background: 'rgba(99,102,241,0.06)',
              borderRadius: 6,
              border: '1px solid rgba(99,102,241,0.15)',
              fontSize: 11,
              color: '#475569',
              lineHeight: 1.6,
            }}>
              To make a commit:<br />
              1. Edit files in VS Code or any editor<br />
              2. Save the file<br />
              3. It appears here automatically<br />
              4. Click + to stage, then Commit
            </div>
          </div>
        ) : (
          unstagedFiles.map((f) => (
            <FileStatusRow
              key={f.path}
              file={f}
              action="stage"
              onAction={() => onStage(f.path)}
              onDiscard={() => onDiscard(f.path)}
            />
          ))
        )}
      </div>

      {/* Commit message + button */}
      <div style={{ padding: '10px 10px 12px', borderTop: '1px solid #1e293b' }}>
        <textarea
          placeholder="Commit message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            background: '#080e1a',
            border: '1px solid #1e293b',
            borderRadius: 6,
            color: '#e2e8f0',
            fontSize: 12,
            padding: '7px 9px',
            resize: 'none',
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleCommit}
          disabled={!message.trim() || stagedFiles.length === 0 || isCommitting}
          style={{
            marginTop: 8,
            width: '100%',
            background:
              !message.trim() || stagedFiles.length === 0
                ? '#1e293b'
                : '#6366f1',
            border: 'none',
            borderRadius: 6,
            color:
              !message.trim() || stagedFiles.length === 0 ? '#475569' : '#fff',
            fontSize: 13,
            fontWeight: 500,
            padding: '8px 0',
            cursor:
              !message.trim() || stagedFiles.length === 0
                ? 'default'
                : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {isCommitting ? 'Committing...' : 'Commit'}
        </button>
      </div>
    </div>
  );
}

function FileStatusRow({
  file,
  action,
  onAction,
  onDiscard,
}: {
  file: FileStatus;
  action: 'stage' | 'unstage';
  onAction: () => void;
  onDiscard?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const kindColors: Record<string, string> = {
    modified: '#f59e0b',
    added: '#22c55e',
    deleted: '#ef4444',
    untracked: '#94a3b8',
    renamed: '#8b5cf6',
    conflicted: '#f43f5e',
    copied: '#6366f1',
  };
  const kindLetters: Record<string, string> = {
    modified: 'M', added: 'A', deleted: 'D', untracked: '?',
    renamed: 'R', conflicted: '!', copied: 'C',
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        fontSize: 12,
        background: hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
      }}
    >
      <span
        style={{
          color: kindColors[file.kind] ?? '#94a3b8',
          fontWeight: 700,
          fontSize: 10,
          width: 10,
          textAlign: 'center',
        }}
      >
        {kindLetters[file.kind] ?? '?'}
      </span>
      <span
        style={{
          flex: 1,
          color: '#94a3b8',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={file.path}
      >
        {file.path.split('/').pop() ?? file.path}
      </span>
      {hovered && (
        <div style={{ display: 'flex', gap: 3 }}>
          <button onClick={onAction} style={tinyBtnStyle} title={action}>
            {action === 'stage' ? '+' : '−'}
          </button>
          {onDiscard && (
            <button
              onClick={onDiscard}
              style={{ ...tinyBtnStyle, color: '#ef4444' }}
              title="Discard changes"
            >
              ↺
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── New branch modal ───────────────────────────────────────────────────────────
function NewBranchModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0f1929',
          border: '1px solid #1e293b',
          borderRadius: 12,
          padding: 24,
          width: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>
          New branch
        </div>
        <input
          autoFocus
          type="text"
          placeholder="branch-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onCreate(name.trim())}
          style={{
            background: '#080e1a',
            border: '1px solid #1e293b',
            borderRadius: 7,
            color: '#e2e8f0',
            fontSize: 13,
            padding: '9px 12px',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
          <button
            onClick={() => name.trim() && onCreate(name.trim())}
            disabled={!name.trim()}
            style={primaryBtnStyle}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RepoDetailPage() {
  const activeRepo = useRepoStore((s) => s.activeRepo);
  const fileStatuses = useRepoStore((s) => s.fileStatuses);
  const branches = useRepoStore((s) => s.branches);

  const activeTab = useUiStore((s) => s.activeTab);
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const selectedFilePath = useUiStore((s) => s.selectedFilePath);
  const setSelectedFilePath = useUiStore((s) => s.setSelectedFilePath);
  const selectedCommitOid = useUiStore((s) => s.selectedCommitOid);
  const setSelectedCommitOid = useUiStore((s) => s.setSelectedCommitOid);
  const selectedBranchName = useUiStore((s) => s.selectedBranchName);
  const setSelectedBranchName = useUiStore((s) => s.setSelectedBranchName);

  const { refresh } = useRepo();
  const { commits, isLoading: commitsLoading, hasMore, loadMore, error: commitsError } = useCommitLog(
    activeRepo?.path ?? null,
  );
  const { diff, isLoading: diffLoading } = useDiff(
    activeRepo?.path ?? null,
    selectedFilePath,
    false,
  );

  const [fileTree, setFileTree] = useState<TreeNode[]>([]);
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [showCommitDetail, setShowCommitDetail] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);

  // Load file tree whenever active repo changes
  useEffect(() => {
    if (!activeRepo) return;
    getFileTree(activeRepo.path)
      .then(setFileTree)
      .catch(() => setFileTree([]));
  }, [activeRepo]);

  if (!activeRepo) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#334155',
          fontSize: 14,
        }}
      >
        Select a repository from the sidebar
      </div>
    );
  }

  const stagedFiles = fileStatuses.filter((f) => f.isStaged);
  const unstagedFiles = fileStatuses.filter((f) => f.isUnstaged);

  // ── Git operations ──────────────────────────────────────────────────────────
  const handleStage = async (filePath: string) => {
    try { await stageFile(activeRepo.path, filePath); await refresh(); }
    catch (e: any) { setOpError(e.message); }
  };

  const handleUnstage = async (filePath: string) => {
    try { await unstageFile(activeRepo.path, filePath); await refresh(); }
    catch (e: any) { setOpError(e.message); }
  };

  const handleStageAll = async () => {
    try { await stageAll(activeRepo.path); await refresh(); }
    catch (e: any) { setOpError(e.message); }
  };

  const handleDiscard = async (filePath: string) => {
    const yes = await confirm(`Discard changes to ${filePath}? This cannot be undone.`, {
      title: 'Discard changes',
      kind: 'warning',
    });
    if (!yes) return;
    try { await discardFile(activeRepo.path, filePath); await refresh(); }
    catch (e: any) { setOpError(e.message); }
  };

  const handleCommit = async (message: string) => {
    try {
      // Read author from settings, fall back to git config values
      let authorName = 'GitLane User';
      let authorEmail = 'user@gitlane.local';
      try {
        const { getSettings } = await import('../lib/git/repo');
        const settings = await getSettings();
        if (settings.authorName) authorName = settings.authorName;
        if (settings.authorEmail) authorEmail = settings.authorEmail;
      } catch { /* use fallback values */ }

      await createCommit(activeRepo.path, message, authorName, authorEmail);
      await refresh();
    } catch (e: any) {
      setOpError(e.message ?? String(e));
    }
  };

  const handleSwitchBranch = async (name: string) => {
    try {
      const result = await switchBranch(activeRepo.path, name);
      if (result.conflicts.length > 0) {
        setOpError(`Cannot switch: conflicts in ${result.conflicts.join(', ')}`);
        return;
      }
      await refresh();
    } catch (e: any) { setOpError(e.message); }
  };

  const handleDeleteBranch = async (name: string) => {
    const yes = await confirm(`Delete branch "${name}"?`, {
      title: 'Delete branch',
      kind: 'warning',
    });
    if (!yes) return;
    try { await deleteBranch(activeRepo.path, name); await refresh(); }
    catch (e: any) { setOpError(e.message); }
  };

  const handleCreateBranch = async (name: string) => {
    try {
      await createBranch(activeRepo.path, name);
      setShowNewBranch(false);
      await refresh();
    } catch (e: any) { setOpError(e.message); }
  };

  // ── Tab content ─────────────────────────────────────────────────────────────
  const TABS: { id: RepoTab; label: string }[] = [
    { id: 'files', label: 'Files' },
    { id: 'history', label: 'History' },
    { id: 'branches', label: 'Branches' },
  ];

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Error toast */}
      {opError && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(239,68,68,0.9)',
            color: '#fff',
            fontSize: 13,
            padding: '8px 16px',
            borderRadius: 8,
            zIndex: 200,
            maxWidth: 400,
            textAlign: 'center',
          }}
          onClick={() => setOpError(null)}
        >
          {opError} (click to dismiss)
        </div>
      )}

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid #1e293b',
          background: '#0b1120',
          padding: '0 16px',
          gap: 2,
          flexShrink: 0,
        }}
      >
        {/* Repo name */}
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#64748b',
            marginRight: 10,
          }}
        >
          {activeRepo.name}
        </span>
        <span style={{ color: '#1e293b', marginRight: 10 }}>/</span>

        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id
                ? '2px solid #6366f1'
                : '2px solid transparent',
              color: activeTab === tab.id ? '#e2e8f0' : '#475569',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 500 : 400,
              padding: '10px 14px',
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── FILES TAB ── */}
        {activeTab === 'files' && (
          <>
            {/* Left: file tree */}
            <div
              style={{
                width: 220,
                borderRight: '1px solid #1e293b',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div style={sectionHeaderStyle}>Working tree</div>
              <FileTree
                nodes={fileTree}
                selectedPath={selectedFilePath}
                onSelect={setSelectedFilePath}
              />
            </div>

            {/* Center: diff viewer */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <DiffViewer
                fileChange={diff}
                isLoading={diffLoading}
                repoPath={activeRepo.path}
                selectedFilePath={selectedFilePath}
              />
            </div>

            {/* Right: commit panel */}
            <CommitPanel
              repoPath={activeRepo.path}
              stagedFiles={stagedFiles}
              unstagedFiles={unstagedFiles}
              onStage={handleStage}
              onUnstage={handleUnstage}
              onStageAll={handleStageAll}
              onDiscard={handleDiscard}
              onCommit={handleCommit}
            />
          </>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === 'history' && (
          <>
            {/* Error banner if commit log failed */}
            {commitsError && (
              <div style={{
                position: 'absolute',
                top: 50,
                left: 0,
                right: 0,
                background: 'rgba(239,68,68,0.1)',
                borderBottom: '1px solid rgba(239,68,68,0.2)',
                padding: '8px 16px',
                fontSize: 12,
                color: '#fca5a5',
                zIndex: 10,
              }}>
                Failed to load commits: {commitsError}
              </div>
            )}

            {/* Left: visual graph */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                borderRight: '1px solid #1e293b',
              }}
            >
              <div style={sectionHeaderStyle}>
                Commit graph
                {commitsLoading && <span style={{ color: '#475569', fontWeight: 400 }}>loading...</span>}
              </div>
              {commits.length === 0 && !commitsLoading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 28, opacity: 0.15 }}>◎</div>
                  <div style={{ fontSize: 13, color: '#334155' }}>
                    {commitsError ? 'Error loading history' : 'No commits yet'}
                  </div>
                </div>
              ) : (
                <CommitGraph
                  commits={commits}
                  selectedOid={selectedCommitOid}
                  onSelect={(oid) => { setSelectedCommitOid(oid); setShowCommitDetail(true); }}
                />
              )}
            </div>

            {/* Right: commit list */}
            <div
              style={{
                width: 340,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div style={sectionHeaderStyle}>
                Commits
                <span style={{ color: '#334155', fontWeight: 400 }}>{commits.length} shown</span>
              </div>
              <CommitList
                commits={commits}
                selectedOid={selectedCommitOid}
                onSelect={(oid) => { setSelectedCommitOid(oid); setShowCommitDetail(true); }}
                onLoadMore={loadMore}
                hasMore={hasMore}
                isLoading={commitsLoading}
              />
            </div>

            {/* Commit detail panel — slides in when a commit is selected */}
            {showCommitDetail && selectedCommitOid && (
              <CommitDetailPanel
                repoPath={activeRepo.path}
                oid={selectedCommitOid}
                onClose={() => { setShowCommitDetail(false); setSelectedCommitOid(null); }}
                onRevert={async (oid) => {
                  try {
                    await invoke('revert_commit', { repoPath: activeRepo.path, oid });
                    setShowCommitDetail(false);
                    setSelectedCommitOid(null);
                    await refresh();
                  } catch (e: any) { setOpError(String(e)); }
                }}
              />
            )}
          </>
        )}

        {/* ── BRANCHES TAB ── */}
        {activeTab === 'branches' && (
          <BranchList
            branches={branches}
            selectedName={selectedBranchName}
            onSelect={setSelectedBranchName}
            onSwitch={handleSwitchBranch}
            onDelete={handleDeleteBranch}
            onCreate={() => setShowNewBranch(true)}
          />
        )}
      </div>

      {/* New branch modal */}
      {showNewBranch && (
        <NewBranchModal
          onClose={() => setShowNewBranch(false)}
          onCreate={handleCreateBranch}
        />
      )}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 10,
  fontWeight: 600,
  color: '#475569',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  padding: '8px 10px 5px',
  borderBottom: '1px solid #1e293b',
  flexShrink: 0,
};

const tinyBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #1e293b',
  borderRadius: 4,
  color: '#64748b',
  fontSize: 10,
  padding: '2px 6px',
  cursor: 'pointer',
};

const emptyHintStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#334155',
  padding: '8px 10px',
  fontStyle: 'italic',
};

const primaryBtnStyle: React.CSSProperties = {
  background: '#6366f1',
  border: 'none',
  borderRadius: 6,
  color: '#fff',
  fontSize: 13,
  fontWeight: 500,
  padding: '7px 14px',
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #1e293b',
  borderRadius: 6,
  color: '#64748b',
  fontSize: 13,
  padding: '7px 14px',
  cursor: 'pointer',
};