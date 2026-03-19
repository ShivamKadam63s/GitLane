import React, { useState, useRef, useEffect } from 'react';
import { saveCredential, extractHost } from '../lib/git/remote';

interface CredentialModalProps {
  remoteUrl: string;          // e.g. https://github.com/user/repo.git
  onSaved: () => void;        // called after save — caller retries the operation
  onCancel: () => void;
}

export function CredentialModal({ remoteUrl, onSaved, onCancel }: CredentialModalProps) {
  const host = extractHost(remoteUrl);
  const isGitHub = host.includes('github.com');
  const isGitLab = host.includes('gitlab.com');

  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { usernameRef.current?.focus(); }, []);

  const handleSave = async () => {
    if (!username.trim()) { setError('Username is required'); return; }
    if (!token.trim()) { setError('Token is required'); return; }
    setSaving(true);
    setError(null);
    try {
      await saveCredential(host, username.trim(), token.trim());
      onSaved();
    } catch (e: any) {
      setError(String(e));
      setSaving(false);
    }
  };

  const tokenHelpUrl = isGitHub
    ? 'https://github.com/settings/tokens/new?scopes=repo&description=GitLane'
    : isGitLab
    ? 'https://gitlab.com/-/user_settings/personal_access_tokens'
    : undefined;

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0f1929', border: '1px solid #1e293b', borderRadius: 14,
          padding: '28px', width: 440, display: 'flex', flexDirection: 'column', gap: 18,
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
            Authentication required
          </div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            Enter credentials for <span style={{ color: '#818cf8', fontFamily: 'monospace' }}>{host}</span>
          </div>
        </div>

        {/* Username */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>Username</label>
          <input
            ref={usernameRef}
            type="text"
            placeholder={isGitHub ? 'your-github-username' : 'username'}
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            style={{
              background: '#080e1a', border: '1px solid #1e293b', borderRadius: 8,
              color: '#e2e8f0', fontSize: 13, padding: '10px 12px', outline: 'none',
            }}
          />
        </div>

        {/* Token */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>
              Personal Access Token
            </label>
            {tokenHelpUrl && (
              <a
                href={tokenHelpUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none' }}
              >
                Generate token ↗
              </a>
            )}
          </div>
          <input
            type="password"
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            value={token}
            onChange={(e) => { setToken(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            style={{
              background: '#080e1a', border: '1px solid #1e293b', borderRadius: 8,
              color: '#e2e8f0', fontSize: 13, padding: '10px 12px', outline: 'none',
              fontFamily: 'monospace',
            }}
          />
          <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.5 }}>
            {isGitHub
              ? 'Required scopes: repo (for private), public_repo (for public)'
              : isGitLab
              ? 'Required scopes: read_repository, write_repository'
              : 'Use a Personal Access Token, not your account password'}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#fca5a5',
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              background: 'none', border: '1px solid #1e293b', borderRadius: 8,
              color: '#64748b', fontSize: 13, padding: '9px 20px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !username.trim() || !token.trim()}
            style={{
              background: saving || !username.trim() || !token.trim() ? '#1e293b' : '#6366f1',
              border: 'none', borderRadius: 8,
              color: saving || !username.trim() || !token.trim() ? '#475569' : '#fff',
              fontSize: 13, fontWeight: 500, padding: '9px 24px',
              cursor: saving || !username.trim() || !token.trim() ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Save & retry'}
          </button>
        </div>
      </div>
    </div>
  );
}