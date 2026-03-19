import React, { useState, useEffect } from 'react';
import { confirm } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { getCommitDiff } from '../lib/git/diff';
import { DiffViewer } from './DiffViewer';
import type { FileChange } from '../types';

// How long ago helper
function timeAgo(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString();
}

// Kind badge color and letter
const KIND_COLOR: Record<string, string> = {
  modified: '#f59e0b',
  added: '#22c55e',
  deleted: '#ef4444',
  renamed: '#8b5cf6',
  copied: '#6366f1',
  conflicted: '#f43f5e',
};
const KIND_LETTER: Record<string, string> = {
  modified: 'M', added: 'A', deleted: 'D', renamed: 'R', copied: 'C', conflicted: '!',
};

interface CommitDetailPanelProps {
  repoPath: string;
  oid: string;
  onClose: () => void;
  onRevert: (oid: string) => void;
}

export function CommitDetailPanel({
  repoPath,
  oid,
  onClose,
  onRevert,
}: CommitDetailPanelProps) {
  // Commit metadata
  const [meta, setMeta] = useState<any>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  // File diffs for this commit
  const [files, setFiles] = useState<FileChange[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);

  // Which file is selected for inline diff view
  const [selectedFile, setSelectedFile] = useState<FileChange | null>(null);

  // Load commit metadata and diffs when oid changes
  useEffect(() => {
    if (!oid) return;

    setMeta(null);
    setMetaError(null);
    setMetaLoading(true);
    setFiles([]);
    setFilesError(null);
    setFilesLoading(true);
    setSelectedFile(null);

    // Load metadata
    invoke('get_commit_detail', { repoPath, oid })
      .then((d) => { setMeta(d); setMetaLoading(false); })
      .catch((e) => { setMetaError(String(e)); setMetaLoading(false); });

    // Load full diffs (separate call so metadata shows fast)
    getCommitDiff(repoPath, oid)
      .then((d) => { setFiles(d); setFilesLoading(false); })
      .catch((e) => { setFilesError(String(e)); setFilesLoading(false); });
  }, [repoPath, oid]);

  const handleRevertClick = async () => {
    const shortOid = oid.slice(0, 7);
    const yes = await confirm(
      `Revert commit ${shortOid}?\n\nThis creates a new commit that undoes those changes. Your history is preserved.`,
      { title: 'Revert commit', kind: 'warning' }
    );
    if (yes) onRevert(oid);
  };

  return (
    <div style={{
      width: 420,
      borderLeft: '1px solid #1e293b',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: '#0b1120',
      flexShrink: 0,
    }}>
      {/* Panel header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid #1e293b',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Commit detail
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, padding: '2px 6px', borderRadius: 4 }}
          title="Close"
        >
          ×
        </button>
      </div>

      {/* Content area — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Metadata section */}
        {metaLoading ? (
          <div style={{ padding: '16px 14px', fontSize: 12, color: '#475569' }}>Loading...</div>
        ) : metaError ? (
          <div style={{ padding: '16px 14px', fontSize: 12, color: '#ef4444' }}>{metaError}</div>
        ) : meta ? (
          <div style={{ padding: '14px 14px 0' }}>
            {/* Commit message */}
            <div style={{ fontSize: 14, fontWeight: 500, color: '#e2e8f0', lineHeight: 1.5, marginBottom: 10 }}>
              {meta.message}
            </div>
            {meta.body && (
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {meta.body}
              </div>
            )}

            {/* Author + meta row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              paddingBottom: 12,
              borderBottom: '1px solid #1e293b',
            }}>
              {/* Author avatar */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: `hsl(${(meta.authorName ?? '').split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0) * 37 % 360},40%,30%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600, color: '#e2e8f0', flexShrink: 0,
              }}>
                {(meta.authorName ?? '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {meta.authorName}
                  <span style={{ color: '#475569', marginLeft: 4 }}>&lt;{meta.authorEmail}&gt;</span>
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>
                  {timeAgo(meta.timestamp ?? 0)} — {new Date((meta.timestamp ?? 0) * 1000).toLocaleString()}
                </div>
              </div>
            </div>

            {/* SHA + revert */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6366f1', letterSpacing: '0.05em' }}>
                {oid.slice(0, 16)}
              </span>
              <button
                onClick={handleRevertClick}
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 6,
                  color: '#fca5a5',
                  fontSize: 11,
                  padding: '4px 10px',
                  cursor: 'pointer',
                }}
                title="Create a new commit that undoes this one"
              >
                ↩ Revert
              </button>
            </div>
          </div>
        ) : null}

        {/* Files changed section */}
        <div style={{
          fontSize: 10, fontWeight: 600, color: '#475569',
          letterSpacing: '0.08em', textTransform: 'uppercase',
          padding: '8px 14px 4px',
          borderTop: '1px solid #1e293b',
          flexShrink: 0,
        }}>
          {filesLoading ? 'Loading files...' : `${files.length} file${files.length !== 1 ? 's' : ''} changed`}
        </div>

        {filesError && (
          <div style={{ padding: '8px 14px', fontSize: 12, color: '#ef4444' }}>{filesError}</div>
        )}

        {/* File list */}
        {files.map((f) => {
          const isSelected = selectedFile?.path === f.path;
          return (
            <div
              key={f.path}
              onClick={() => setSelectedFile(isSelected ? null : f)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                cursor: 'pointer',
                background: isSelected ? 'rgba(99,102,241,0.12)' : 'transparent',
                borderLeft: isSelected ? '2px solid #6366f1' : '2px solid transparent',
                borderBottom: '1px solid #0f172a',
                transition: 'background 0.1s',
              }}
            >
              {/* Kind badge */}
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: KIND_COLOR[f.kind] ?? '#94a3b8',
                width: 10, textAlign: 'center', flexShrink: 0,
              }}>
                {KIND_LETTER[f.kind] ?? '?'}
              </span>

              {/* File path */}
              <span style={{
                flex: 1, fontSize: 12, fontFamily: 'monospace',
                color: isSelected ? '#e2e8f0' : '#94a3b8',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
                title={f.path}
              >
                {f.path}
              </span>

              {/* Hunk count */}
              <span style={{ fontSize: 10, color: '#334155', flexShrink: 0 }}>
                {f.hunks.length > 0 ? `${f.hunks.reduce((acc, h) => acc + h.lines.filter(l => l.kind !== 'context').length, 0)} lines` : ''}
              </span>

              {/* Expand/collapse indicator */}
              <span style={{ fontSize: 10, color: '#334155', flexShrink: 0 }}>
                {f.isBinary ? 'binary' : isSelected ? '▲' : '▼'}
              </span>
            </div>
          );
        })}

        {/* Inline diff — expands below the selected file */}
        {selectedFile && (
          <div style={{
            borderTop: '1px solid #1e293b',
            borderBottom: '1px solid #1e293b',
            maxHeight: 400,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}>
            <DiffViewer
              fileChange={selectedFile}
              isLoading={false}
              repoPath={repoPath}
              selectedFilePath={selectedFile.path}
            />
          </div>
        )}

        {/* Empty state */}
        {!filesLoading && !filesError && files.length === 0 && (
          <div style={{ padding: '16px 14px', fontSize: 12, color: '#475569', textAlign: 'center' }}>
            No file changes in this commit
          </div>
        )}
      </div>
    </div>
  );
}