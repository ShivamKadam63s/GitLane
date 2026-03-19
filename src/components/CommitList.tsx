import React from 'react';
import type { CommitSummary } from '../types';

function timeAgo(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString();
}

function AuthorAvatar({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase();
  // deterministic color from name
  const hue = (name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 37) % 360;
  return (
    <div
      style={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        background: `hsl(${hue},50%,35%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 600,
        color: `hsl(${hue},50%,85%)`,
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}

interface CommitListProps {
  commits: CommitSummary[];
  selectedOid: string | null;
  onSelect: (oid: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

export function CommitList({
  commits,
  selectedOid,
  onSelect,
  onLoadMore,
  hasMore,
  isLoading,
}: CommitListProps) {
  if (commits.length === 0 && !isLoading) {
    return (
      <div style={{ padding: 16, color: '#475569', fontSize: 13 }}>
        No commits yet.
      </div>
    );
  }

  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {commits.map((commit, idx) => {
        const isSelected = commit.oid === selectedOid;
        return (
          <div
            key={commit.oid}
            onClick={() => onSelect(commit.oid)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '9px 14px',
              cursor: 'pointer',
              background: isSelected ? 'rgba(99,102,241,0.12)' : 'transparent',
              borderLeft: isSelected ? '2px solid #6366f1' : '2px solid transparent',
              borderBottom: '1px solid #0f172a',
            }}
          >
            {/* Graph line + dot */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: 4,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: isSelected ? '#6366f1' : '#1e3a5f',
                  border: `2px solid ${isSelected ? '#818cf8' : '#2563eb'}`,
                  flexShrink: 0,
                }}
              />
              {idx < commits.length - 1 && (
                <div
                  style={{
                    width: 1,
                    flex: 1,
                    minHeight: 20,
                    background: '#1e293b',
                    marginTop: 2,
                  }}
                />
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: 13,
                  color: isSelected ? '#e2e8f0' : '#cbd5e1',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: 4,
                }}
                title={commit.message}
              >
                {commit.message}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AuthorAvatar name={commit.authorName} />
                <span style={{ fontSize: 11, color: '#475569' }}>
                  {commit.authorName}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: '#334155',
                  }}
                >
                  {commit.shortOid}
                </span>
                <span style={{ fontSize: 11, color: '#334155', marginLeft: 'auto' }}>
                  {timeAgo(commit.timestamp)}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* Load more */}
      {hasMore && (
        <div style={{ padding: 12, textAlign: 'center' }}>
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            style={{
              background: 'none',
              border: '1px solid #1e293b',
              borderRadius: 6,
              color: '#475569',
              fontSize: 12,
              padding: '6px 14px',
              cursor: isLoading ? 'default' : 'pointer',
            }}
          >
            {isLoading ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}