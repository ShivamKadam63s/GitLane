import React, { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../lib/git/repo';
import type { UserSettings } from '../types';

const DEFAULT_SETTINGS: UserSettings = {
  authorName: '',
  authorEmail: '',
  theme: 'dark',
  defaultBranch: 'main',
  fetchOnOpen: false,
  showHiddenFiles: false,
};

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 20,
        padding: '14px 0',
        borderBottom: '1px solid #1e293b',
      }}
    >
      <div>
        <div style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 500 }}>{label}</div>
        {description && (
          <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>{description}</div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

export default function SettingsPage({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => {});
  }, []);

  const update = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

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
      {/* Header */}
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
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#475569',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            padding: '2px 4px',
          }}
        >
          ←
        </button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#e2e8f0' }}>
          Settings
        </h1>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px' }}>
        {/* Git identity */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#475569',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '18px 0 4px',
          }}
        >
          Git identity
        </div>

        <SettingRow label="Author name" description="Used in commit author field">
          <input
            type="text"
            value={settings.authorName}
            onChange={(e) => update('authorName', e.target.value)}
            placeholder="Your name"
            style={inputStyle}
          />
        </SettingRow>

        <SettingRow label="Author email" description="Used in commit author field">
          <input
            type="email"
            value={settings.authorEmail}
            onChange={(e) => update('authorEmail', e.target.value)}
            placeholder="you@example.com"
            style={inputStyle}
          />
        </SettingRow>

        <SettingRow label="Default branch name" description="Used when initializing new repos">
          <input
            type="text"
            value={settings.defaultBranch}
            onChange={(e) => update('defaultBranch', e.target.value)}
            placeholder="main"
            style={{ ...inputStyle, width: 100 }}
          />
        </SettingRow>

        {/* Appearance */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#475569',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '18px 0 4px',
          }}
        >
          Appearance
        </div>

        <SettingRow label="Theme">
          <select
            value={settings.theme}
            onChange={(e) => update('theme', e.target.value as UserSettings['theme'])}
            style={{ ...inputStyle, paddingRight: 24 }}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </SettingRow>

        {/* Behaviour */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#475569',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '18px 0 4px',
          }}
        >
          Behaviour
        </div>

        <SettingRow
          label="Fetch on open"
          description="Automatically fetch from remote when opening a repo"
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.fetchOnOpen}
              onChange={(e) => update('fetchOnOpen', e.target.checked)}
              style={{ width: 15, height: 15, accentColor: '#6366f1', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 13, color: '#64748b' }}>
              {settings.fetchOnOpen ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </SettingRow>

        <SettingRow
          label="Show hidden files"
          description="Show files starting with . in the file tree"
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.showHiddenFiles}
              onChange={(e) => update('showHiddenFiles', e.target.checked)}
              style={{ width: 15, height: 15, accentColor: '#6366f1', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 13, color: '#64748b' }}>
              {settings.showHiddenFiles ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </SettingRow>

        {/* About */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#475569',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '18px 0 4px',
          }}
        >
          About
        </div>
        <div style={{ padding: '10px 0 24px', fontSize: 13, color: '#334155' }}>
          GitLane v0.1.0 — A desktop Git client built with Tauri + React
        </div>
      </div>

      {/* Save bar */}
      <div
        style={{
          padding: '12px 28px',
          borderTop: '1px solid #1e293b',
          background: '#0b1120',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
        }}
      >
        {saved && (
          <span style={{ fontSize: 13, color: '#22c55e', alignSelf: 'center' }}>
            Saved ✓
          </span>
        )}
        <button onClick={handleSave} disabled={isSaving} style={primaryBtnStyle}>
          {isSaving ? 'Saving...' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#080e1a',
  border: '1px solid #1e293b',
  borderRadius: 7,
  color: '#e2e8f0',
  fontSize: 13,
  padding: '7px 10px',
  outline: 'none',
  minWidth: 200,
};

const primaryBtnStyle: React.CSSProperties = {
  background: '#6366f1',
  border: 'none',
  borderRadius: 7,
  color: '#fff',
  fontSize: 13,
  fontWeight: 500,
  padding: '8px 20px',
  cursor: 'pointer',
};