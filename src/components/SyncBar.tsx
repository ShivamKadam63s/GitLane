import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRepoStore } from '../store/repoStore';
import {
  getRemotes,
  fetchRemote,
  pushBranch,
  pullBranch,
  type RemoteInfo,
  type PushResult,
  type FetchResult,
} from '../lib/git/remote';
import { CredentialModal } from './CredentialModal';

type SyncState = 'idle' | 'fetching' | 'pushing' | 'pulling';
type PendingOp = 'fetch' | 'push' | 'pull' | null;

export function SyncBar() {
  const activeRepo = useRepoStore((s) => s.activeRepo);
  const fileStatuses = useRepoStore((s) => s.fileStatuses);

  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  // Instead of storing a closure (which captures stale state),
  // store the NAME of the operation to retry. Then after credentials
  // are saved we call the current (fresh) handler by name.
  const [credentialUrl, setCredentialUrl] = useState<string | null>(null);
  const [pendingOp, setPendingOp] = useState<PendingOp>(null);

  // useRef to track sync state without stale closure issues
  const syncStateRef = useRef<SyncState>('idle');

  const dirtyCount = fileStatuses.filter((f) => f.isUnstaged).length;
  const stagedCount = fileStatuses.filter((f) => f.isStaged).length;

  useEffect(() => {
    if (!activeRepo) { setRemotes([]); return; }
    getRemotes(activeRepo.path)
      .then(setRemotes)
      .catch(() => setRemotes([]));
  }, [activeRepo]);

  const primaryRemote = remotes[0];
  const hasRemote = remotes.length > 0;

  const setSyncStateSync = (s: SyncState) => {
    syncStateRef.current = s;
    setSyncState(s);
  };

  const showMessage = useCallback((msg: string, error = false, duration = 4000) => {
    setSyncMessage(msg);
    setIsError(error);
    if (duration > 0) setTimeout(() => setSyncMessage(null), duration);
  }, []);

  // Core push logic — extracted so it can be called directly after credential save
  const executePush = useCallback(async (
    repoPath: string,
    remoteName: string,
    remoteUrl: string,
    branchName: string,
  ) => {
    setSyncStateSync('pushing');
    setSyncMessage(null);
    try {
      const result: PushResult = await pushBranch(repoPath, remoteName, branchName);
      if (result.success) {
        showMessage(`Pushed ${branchName} to ${remoteName}`);
      } else if (result.needsCredentials) {
        // Store the op name, not a closure — retry will call executePush fresh
        setCredentialUrl(remoteUrl);
        setPendingOp('push');
      } else {
        showMessage(result.error ?? 'Push failed', true, 8000);
      }
    } catch (e: any) {
      showMessage(String(e), true);
    } finally {
      setSyncStateSync('idle');
    }
  }, [showMessage]);

  const executeFetch = useCallback(async (
    repoPath: string,
    remoteName: string,
    remoteUrl: string,
  ) => {
    setSyncStateSync('fetching');
    setSyncMessage(null);
    try {
      const result: FetchResult = await fetchRemote(repoPath, remoteName);
      if (result.success) {
        const msg = result.updatedRefs.length > 0
          ? `Fetched ${result.updatedRefs.length} update${result.updatedRefs.length > 1 ? 's' : ''}`
          : 'Already up to date';
        showMessage(msg);
      } else if (result.needsCredentials) {
        setCredentialUrl(remoteUrl);
        setPendingOp('fetch');
      } else {
        showMessage(result.error ?? 'Fetch failed', true);
      }
    } catch (e: any) {
      showMessage(String(e), true);
    } finally {
      setSyncStateSync('idle');
    }
  }, [showMessage]);

  const executePull = useCallback(async (
    repoPath: string,
    remoteName: string,
    remoteUrl: string,
    branchName: string,
  ) => {
    setSyncStateSync('pulling');
    setSyncMessage(null);
    try {
      const result: FetchResult = await pullBranch(repoPath, remoteName, branchName);
      if (result.success) {
        showMessage(result.updatedRefs[0] ?? `Pulled ${branchName}`);
      } else if (result.needsCredentials) {
        setCredentialUrl(remoteUrl);
        setPendingOp('pull');
      } else {
        showMessage(result.error ?? 'Pull failed', true, 8000);
      }
    } catch (e: any) {
      showMessage(String(e), true);
    } finally {
      setSyncStateSync('idle');
    }
  }, [showMessage]);

  const handleFetch = useCallback(() => {
    if (!activeRepo || !primaryRemote || syncStateRef.current !== 'idle') return;
    executeFetch(activeRepo.path, primaryRemote.name, primaryRemote.url);
  }, [activeRepo, primaryRemote, executeFetch]);

  const handlePush = useCallback(() => {
    if (!activeRepo || !primaryRemote || syncStateRef.current !== 'idle') return;
    if (!activeRepo.currentBranch) { showMessage('No branch to push', true); return; }
    executePush(activeRepo.path, primaryRemote.name, primaryRemote.url, activeRepo.currentBranch);
  }, [activeRepo, primaryRemote, executePush, showMessage]);

  const handlePull = useCallback(() => {
    if (!activeRepo || !primaryRemote || syncStateRef.current !== 'idle') return;
    if (!activeRepo.currentBranch) { showMessage('No branch to pull', true); return; }
    executePull(activeRepo.path, primaryRemote.name, primaryRemote.url, activeRepo.currentBranch);
  }, [activeRepo, primaryRemote, executePull, showMessage]);

  // Called after credentials are saved successfully.
  // Uses pendingOp NAME (not a stale closure) to call the current fresh handler.
  // Small delay ensures Rust has finished writing credentials to disk.
  const handleCredentialSaved = useCallback(() => {
    const op = pendingOp;
    setCredentialUrl(null);
    setPendingOp(null);

    if (!op || !activeRepo || !primaryRemote) return;

    // 150ms delay: gives Rust's file write time to flush before retry
    setTimeout(() => {
      if (op === 'fetch') handleFetch();
      else if (op === 'push') handlePush();
      else if (op === 'pull') handlePull();
    }, 150);
  }, [pendingOp, activeRepo, primaryRemote, handleFetch, handlePush, handlePull]);

  const isBusy = syncState !== 'idle';

  return (
    <>
      <div style={{
        height: 30, background: '#0b1120', borderTop: '1px solid #1e293b',
        display: 'flex', alignItems: 'center', padding: '0 10px',
        gap: 6, fontSize: 11, color: '#475569', flexShrink: 0, userSelect: 'none',
      }}>
        {activeRepo ? (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 4 }}>
              <span style={{ color: '#6366f1', fontSize: 13 }}>⎇</span>
              <span style={{ color: '#94a3b8' }}>{activeRepo.currentBranch}</span>
            </span>

            {dirtyCount > 0 && <span style={{ color: '#f59e0b' }}>{dirtyCount} modified</span>}
            {stagedCount > 0 && <span style={{ color: '#22c55e' }}>{stagedCount} staged</span>}
            {dirtyCount === 0 && stagedCount === 0 && <span style={{ color: '#22c55e' }}>clean</span>}

            {activeRepo.aheadCount > 0 && <span style={{ color: '#818cf8' }}>↑{activeRepo.aheadCount}</span>}
            {activeRepo.behindCount > 0 && <span style={{ color: '#fb923c' }}>↓{activeRepo.behindCount}</span>}

            {syncMessage && (
              <span style={{
                color: isError ? '#fca5a5' : '#94a3b8', marginLeft: 4,
                maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {isError ? '✕ ' : '✓ '}{syncMessage}
              </span>
            )}

            {isBusy && (
              <span style={{ color: '#6366f1', marginLeft: 4 }}>
                {syncState === 'fetching' ? 'Fetching...'
                  : syncState === 'pushing' ? 'Pushing...'
                  : 'Pulling...'}
              </span>
            )}

            <div style={{ flex: 1 }} />

            {hasRemote && (
              <span style={{ color: '#1e3a5f', fontFamily: 'monospace', marginRight: 4 }}>
                {primaryRemote.name}
              </span>
            )}

            {hasRemote && (
              <>
                <SyncButton label="Fetch" title="Download changes from remote (does not update your files)"
                  onClick={handleFetch} disabled={isBusy} active={syncState === 'fetching'} />
                <SyncButton label="↓ Pull" title="Fetch + merge remote changes into your current branch"
                  onClick={handlePull} disabled={isBusy} active={syncState === 'pulling'} color="#22c55e" />
                <SyncButton label="↑ Push" title="Upload your commits to the remote"
                  onClick={handlePush} disabled={isBusy} active={syncState === 'pushing'} color="#6366f1" />
              </>
            )}

            <span style={{
              color: '#1e3a5f', fontFamily: 'monospace', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200, marginLeft: 6,
            }} title={activeRepo.path}>
              {activeRepo.path}
            </span>
          </>
        ) : (
          <span>No repository open</span>
        )}
      </div>

      {credentialUrl && (
        <CredentialModal
          remoteUrl={credentialUrl}
          onSaved={handleCredentialSaved}
          onCancel={() => { setCredentialUrl(null); setPendingOp(null); }}
        />
      )}
    </>
  );
}

function SyncButton({ label, title, onClick, disabled, active, color }: {
  label: string; title: string; onClick: () => void;
  disabled: boolean; active: boolean; color?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: active ? 'rgba(99,102,241,0.2)' : hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
        border: `1px solid ${hovered || active ? '#2d3f5e' : '#1e293b'}`,
        borderRadius: 4, color: disabled ? '#334155' : color ?? '#64748b',
        fontSize: 11, padding: '2px 8px', cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.1s', height: 20, display: 'flex', alignItems: 'center',
      }}
    >
      {label}
    </button>
  );
}