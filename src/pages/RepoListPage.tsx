import { ClonePanel } from '../components/ClonePanel';
import React, { useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useRepoStore } from '../store/repoStore';
import { useUiStore } from '../store/uiStore';
import { openRepo } from '../lib/git/repo';
import type { Repository } from '../types';

function timeAgo(unixMs: number): string {
  const diff = Date.now() - unixMs;
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function RepoCard({
  repo,
  onOpen,
  onRemove,
}: {
  repo: Repository;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const hue = (repo.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 37) % 360;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#0f1929' : '#0b1120',
        border: `1px solid ${hovered ? '#2d3f5e' : '#1e293b'}`,
        borderRadius: 12,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
      onClick={onOpen}
    >
      {/* Top row: icon + name + remove button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 9,
            background: `hsl(${hue},45%,18%)`,
            border: `1px solid hsl(${hue},45%,28%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 700,
            color: `hsl(${hue},60%,65%)`,
            flexShrink: 0,
          }}
        >
          {repo.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: '#e2e8f0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {repo.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span
              style={{
                fontSize: 11,
                color: '#22c55e',
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: 4,
                padding: '1px 6px',
              }}
            >
              {repo.currentBranch}
            </span>
            {repo.isDirty && (
              <span style={{ fontSize: 10, color: '#f59e0b' }} title="Uncommitted changes">
                ● modified
              </span>
            )}
          </div>
        </div>
        {/* Remove button — always in layout, only visible on hover */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{
            background: hovered ? 'rgba(239,68,68,0.1)' : 'transparent',
            border: 'none',
            color: hovered ? '#ef4444' : 'transparent',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: '4px 7px',
            borderRadius: 5,
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
          title="Remove from list"
        >
          ×
        </button>
      </div>

      {/* Last commit */}
      {repo.lastCommit && (
        <div style={{ fontSize: 12, color: '#475569', overflow: 'hidden' }}>
          <span
            style={{
              fontFamily: 'monospace',
              color: '#334155',
              marginRight: 6,
            }}
          >
            {repo.lastCommit.shortOid}
          </span>
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'inline-block',
              maxWidth: '80%',
              verticalAlign: 'bottom',
            }}
          >
            {repo.lastCommit.message}
          </span>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 2,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: '#1e3a5f',
            fontFamily: 'monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '70%',
          }}
          title={repo.path}
        >
          {repo.path}
        </span>
        <span style={{ fontSize: 11, color: '#334155', flexShrink: 0 }}>
          {timeAgo(repo.addedAt)}
        </span>
      </div>

      {/* Ahead / behind */}
      {(repo.aheadCount > 0 || repo.behindCount > 0) && (
        <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
          {repo.aheadCount > 0 && (
            <span style={{ color: '#818cf8' }}>↑ {repo.aheadCount} ahead</span>
          )}
          {repo.behindCount > 0 && (
            <span style={{ color: '#fb923c' }}>↓ {repo.behindCount} behind</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function RepoListPage({
  onOpenRepo,
}: {
  onOpenRepo: (repo: Repository) => void;
}) {
  const repos = useRepoStore((s) => s.repos);
  const loadRepos = useRepoStore((s) => s.loadRepos);
  const addRepo = useRepoStore((s) => s.addRepo);
  const removeRepo = useRepoStore((s) => s.removeRepo);
  const openPanel = useUiStore((s) => s.openPanel);
  const setOpenPanel = useUiStore((s) => s.setOpenPanel);

  const [search, setSearch] = useState('');
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  const handleCloneSuccess = async (repo: Repository) => {
    await addRepo(repo);
    onOpenRepo(repo);
  };

  const handleOpenFolder = async () => {
    setIsOpening(true);
    setError(null);
    try {
      const selected = await open({ directory: true, multiple: false });
      if (!selected || typeof selected !== 'string') return;
      const repo = await openRepo(selected);
      await addRepo(repo);
      onOpenRepo(repo);
    } catch (e: any) {
      setError(e.message ?? 'Failed to open repository');
    } finally {
      setIsOpening(false);
    }
  };

  const filtered = repos.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#080e1a',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          padding: '18px 28px 16px',
          borderBottom: '1px solid #1e293b',
          background: '#0b1120',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              color: '#e2e8f0',
              letterSpacing: '-0.4px',
            }}
          >
            Repositories
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#475569' }}>
            {repos.length} {repos.length === 1 ? 'repository' : 'repositories'}
          </p>
        </div>
        <button
          onClick={() => setOpenPanel('clone')}
          style={secondaryBtnStyle}
        >
          Clone URL
        </button>
        <button
          onClick={handleOpenFolder}
          disabled={isOpening}
          style={primaryBtnStyle}
        >
          {isOpening ? 'Opening...' : '+ Open folder'}
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 28px' }}>
        <input
          type="text"
          placeholder="Search repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchInputStyle}
        />
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            margin: '0 28px 12px',
            padding: '10px 14px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8,
            color: '#fca5a5',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Repo grid */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 28px 28px',
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '60%',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 32, opacity: 0.2 }}>⬡</div>
            <div style={{ fontSize: 14, color: '#334155' }}>
              {search ? 'No repositories match your search' : 'No repositories yet'}
            </div>
            {!search && (
              <button onClick={handleOpenFolder} style={primaryBtnStyle}>
                Open a folder
              </button>
            )}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 12,
              paddingTop: 4,
            }}
          >
            {filtered.map((repo) => (
              <RepoCard
                key={repo.path}
                repo={repo}
                onOpen={() => onOpenRepo(repo)}
                onRemove={() => removeRepo(repo.path)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Clone panel — rendered as overlay when openPanel === 'clone' */}
      {openPanel === 'clone' && (
        <ClonePanel
          onClose={() => setOpenPanel(null)}
          onSuccess={handleCloneSuccess}
        />
      )}
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  background: '#6366f1',
  border: 'none',
  borderRadius: 7,
  color: '#fff',
  fontSize: 13,
  fontWeight: 500,
  padding: '8px 16px',
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #1e293b',
  borderRadius: 7,
  color: '#64748b',
  fontSize: 13,
  padding: '8px 16px',
  cursor: 'pointer',
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0b1120',
  border: '1px solid #1e293b',
  borderRadius: 8,
  padding: '8px 14px',
  fontSize: 13,
  color: '#e2e8f0',
  outline: 'none',
  boxSizing: 'border-box',
};