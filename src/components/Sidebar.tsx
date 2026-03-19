import React from 'react';
import { useRepoStore } from '../store/repoStore';
import { useUiStore } from '../store/uiStore';
import type { Repository } from '../types';

interface SidebarProps {
  onNavigateHome: () => void;
  onOpenSettings: () => void;
}

function RepoItem({
  repo,
  isActive,
  onClick,
}: {
  repo: Repository;
  isActive: boolean;
  onClick: () => void;
}) {
  const initial = repo.name.charAt(0).toUpperCase();
  return (
    <button
      onClick={onClick}
      title={repo.path}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 12px',
        background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
        border: 'none',
        borderLeft: isActive ? '2px solid #6366f1' : '2px solid transparent',
        borderRadius: 0,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: isActive ? '#6366f1' : '#1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 600,
          color: isActive ? '#fff' : '#94a3b8',
          flexShrink: 0,
        }}
      >
        {initial}
      </div>
      <div style={{ overflow: 'hidden' }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: isActive ? '#e2e8f0' : '#94a3b8',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {repo.name}
        </div>
        <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>
          {repo.currentBranch}
          {repo.isDirty && (
            <span style={{ color: '#f59e0b', marginLeft: 4 }}>●</span>
          )}
        </div>
      </div>
    </button>
  );
}

export function Sidebar({ onNavigateHome, onOpenSettings }: SidebarProps) {
  const repos = useRepoStore((s) => s.repos);
  const activeRepo = useRepoStore((s) => s.activeRepo);
  const setActiveRepo = useRepoStore((s) => s.setActiveRepo);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  if (sidebarCollapsed) {
    return (
      <div
        style={{
          width: 48,
          background: '#0b1120',
          borderRight: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 12,
          gap: 8,
        }}
      >
        <button
          onClick={toggleSidebar}
          style={iconBtnStyle}
          title="Expand sidebar"
        >
          ▶
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        width: 220,
        background: '#0b1120',
        borderRight: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 12px 10px',
          borderBottom: '1px solid #1e293b',
        }}
      >
        <button
          onClick={onNavigateHome}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: 0,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: '#fff',
              fontWeight: 700,
            }}
          >
            G
          </div>
          <span
            style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.3px' }}
          >
            GitLane
          </span>
        </button>
        <button onClick={toggleSidebar} style={iconBtnStyle} title="Collapse sidebar">
          ◀
        </button>
      </div>

      {/* Repo list */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 6 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#475569',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '6px 14px 4px',
          }}
        >
          Repositories
        </div>
        {repos.length === 0 && (
          <div
            style={{
              fontSize: 12,
              color: '#475569',
              padding: '12px 14px',
              lineHeight: 1.5,
            }}
          >
            No repos yet.
            <br />
            Open one to start.
          </div>
        )}
        {repos.map((repo) => (
          <RepoItem
            key={repo.path}
            repo={repo}
            isActive={activeRepo?.path === repo.path}
            onClick={() => setActiveRepo(repo)}
          />
        ))}
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #1e293b', padding: '8px 4px' }}>
        <button
          onClick={onOpenSettings}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '7px 12px',
            background: 'none',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            color: '#64748b',
          }}
        >
          <span style={{ fontSize: 14 }}>⚙</span> Settings
        </button>
      </div>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#475569',
  cursor: 'pointer',
  fontSize: 11,
  padding: 4,
  borderRadius: 4,
};