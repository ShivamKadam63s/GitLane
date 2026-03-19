import React from 'react';
import { useRepoStore } from '../store/repoStore';

export function StatusBar() {
  const activeRepo = useRepoStore((s) => s.activeRepo);
  const fileStatuses = useRepoStore((s) => s.fileStatuses);

  const dirtyCount = fileStatuses.filter((f) => f.isUnstaged).length;
  const stagedCount = fileStatuses.filter((f) => f.isStaged).length;

  return (
    <div
      style={{
        height: 28,
        background: '#0b1120',
        borderTop: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        gap: 16,
        fontSize: 11,
        color: '#475569',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {activeRepo ? (
        <>
          {/* Branch */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: '#6366f1' }}>⎇</span>
            <span style={{ color: '#94a3b8' }}>{activeRepo.currentBranch}</span>
          </span>

          {/* Dirty indicator */}
          {dirtyCount > 0 && (
            <span style={{ color: '#f59e0b' }}>
              {dirtyCount} modified
            </span>
          )}
          {stagedCount > 0 && (
            <span style={{ color: '#22c55e' }}>
              {stagedCount} staged
            </span>
          )}
          {dirtyCount === 0 && stagedCount === 0 && (
            <span style={{ color: '#22c55e' }}>clean</span>
          )}

          {/* Ahead / behind */}
          {activeRepo.aheadCount > 0 && (
            <span style={{ color: '#818cf8' }}>
              ↑{activeRepo.aheadCount}
            </span>
          )}
          {activeRepo.behindCount > 0 && (
            <span style={{ color: '#fb923c' }}>
              ↓{activeRepo.behindCount}
            </span>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Repo path */}
          <span
            style={{
              color: '#334155',
              fontFamily: 'monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 300,
            }}
            title={activeRepo.path}
          >
            {activeRepo.path}
          </span>
        </>
      ) : (
        <span>No repository open</span>
      )}
    </div>
  );
}