import React, { useState, useRef, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { cloneRepo } from '../lib/git/repo';
import type { Repository } from '../types';

interface ClonePanelProps {
  onClose: () => void;
  onSuccess: (repo: Repository) => void;
}

// Detects repo name from a git URL
// https://github.com/user/my-project.git  →  my-project
// git@github.com:user/my-project.git      →  my-project
function repoNameFromUrl(url: string): string {
  const clean = url.trim().replace(/\.git$/, '');
  const parts = clean.split(/[/:]/).filter(Boolean);
  return parts[parts.length - 1] ?? 'repo';
}

export function ClonePanel({ onClose, onSuccess }: ClonePanelProps) {
  const [url, setUrl] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [status, setStatus] = useState<'idle' | 'cloning' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Focus URL input when panel opens
  useEffect(() => {
    urlInputRef.current?.focus();
  }, []);

  // Auto-fill suggested folder name when URL changes
  useEffect(() => {
    if (url.trim() && !localPath) {
      // Don't auto-fill if user has already typed a path
    }
  }, [url, localPath]);

  const handlePickFolder = async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        const name = repoNameFromUrl(url);
        // Combine picked parent folder with derived repo name
        const sep = selected.includes('/') ? '/' : '\\';
        setLocalPath(`${selected}${sep}${name}`);
      }
    } catch { /* user cancelled */ }
  };

  const handleClone = async () => {
    const trimmedUrl = url.trim();
    const trimmedPath = localPath.trim();

    if (!trimmedUrl) { setError('Please enter a repository URL'); return; }
    if (!trimmedPath) { setError('Please choose a destination folder'); return; }

    setStatus('cloning');
    setError(null);

    try {
      const repo = await cloneRepo(trimmedUrl, trimmedPath);
      setStatus('done');
      // Small delay so user sees the success state before closing
      setTimeout(() => {
        onSuccess(repo);
        onClose();
      }, 800);
    } catch (e: any) {
      setStatus('error');
      // Make error messages more human-readable
      const raw = String(e);
      if (raw.includes('authentication')) {
        setError('Authentication failed. For private repos, use an SSH URL (git@github.com:...) and ensure your SSH key is configured.');
      } else if (raw.includes('not found') || raw.includes('404')) {
        setError('Repository not found. Check the URL and make sure the repo exists.');
      } else if (raw.includes('already exists')) {
        setError('Destination folder already exists and is not empty. Choose a different path.');
      } else {
        setError(raw);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && status === 'idle') handleClone();
  };

  const isCloning = status === 'cloning';
  const isDone = status === 'done';

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
      }}
    >
      {/* Panel — stop click propagation so clicking inside doesn't close */}
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          background: '#0f1929',
          border: '1px solid #1e293b',
          borderRadius: 14,
          padding: '28px 28px 24px',
          width: 480,
          maxWidth: '90vw',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#e2e8f0' }}>
              Clone repository
            </div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>
              Clone any public or private Git repository to your machine
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18, padding: '2px 6px', borderRadius: 4 }}
          >
            ×
          </button>
        </div>

        {/* URL field */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>
            Repository URL
          </label>
          <input
            ref={urlInputRef}
            type="text"
            placeholder="https://github.com/user/repo.git"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
              setStatus('idle');
            }}
            disabled={isCloning || isDone}
            style={{
              background: '#080e1a',
              border: `1px solid ${error && !url ? '#ef4444' : '#1e293b'}`,
              borderRadius: 8,
              color: '#e2e8f0',
              fontSize: 13,
              padding: '10px 12px',
              outline: 'none',
              fontFamily: 'monospace',
              opacity: isCloning || isDone ? 0.6 : 1,
            }}
          />
          <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.5 }}>
            Supports HTTPS and SSH URLs. Example: git@github.com:user/repo.git
          </div>
        </div>

        {/* Destination folder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>
            Clone into
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="C:\Users\you\projects\repo-name"
              value={localPath}
              onChange={(e) => { setLocalPath(e.target.value); setError(null); }}
              disabled={isCloning || isDone}
              style={{
                flex: 1,
                background: '#080e1a',
                border: `1px solid ${error && !localPath ? '#ef4444' : '#1e293b'}`,
                borderRadius: 8,
                color: '#e2e8f0',
                fontSize: 13,
                padding: '10px 12px',
                outline: 'none',
                fontFamily: 'monospace',
                opacity: isCloning || isDone ? 0.6 : 1,
              }}
            />
            <button
              onClick={handlePickFolder}
              disabled={isCloning || isDone}
              style={{
                background: 'none',
                border: '1px solid #1e293b',
                borderRadius: 8,
                color: '#64748b',
                fontSize: 12,
                padding: '0 14px',
                cursor: isCloning || isDone ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Browse...
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 12,
            color: '#fca5a5',
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        {/* Progress / success state */}
        {isCloning && (
          <div style={{
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 8,
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <CloneSpinner />
            <div>
              <div style={{ fontSize: 13, color: '#818cf8', fontWeight: 500 }}>Cloning...</div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                This may take a moment for large repositories
              </div>
            </div>
          </div>
        )}

        {isDone && (
          <div style={{
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 8,
            padding: '12px 14px',
            fontSize: 13,
            color: '#86efac',
            fontWeight: 500,
          }}>
            ✓ Cloned successfully — opening repository...
          </div>
        )}

        {/* Actions */}
        {!isDone && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              onClick={onClose}
              disabled={isCloning}
              style={{
                background: 'none',
                border: '1px solid #1e293b',
                borderRadius: 8,
                color: '#64748b',
                fontSize: 13,
                padding: '9px 20px',
                cursor: isCloning ? 'default' : 'pointer',
                opacity: isCloning ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleClone}
              disabled={isCloning || !url.trim() || !localPath.trim()}
              style={{
                background: isCloning || !url.trim() || !localPath.trim()
                  ? '#1e293b' : '#6366f1',
                border: 'none',
                borderRadius: 8,
                color: isCloning || !url.trim() || !localPath.trim()
                  ? '#475569' : '#fff',
                fontSize: 13,
                fontWeight: 500,
                padding: '9px 24px',
                cursor: isCloning || !url.trim() || !localPath.trim()
                  ? 'default' : 'pointer',
                transition: 'background 0.15s',
                minWidth: 90,
              }}
            >
              {isCloning ? 'Cloning...' : 'Clone'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple CSS spinner — no library needed
function CloneSpinner() {
  return (
    <div style={{
      width: 18,
      height: 18,
      border: '2px solid #1e293b',
      borderTop: '2px solid #6366f1',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
      flexShrink: 0,
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}