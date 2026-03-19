import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { SyncBar } from './components/SyncBar';
import RepoListPage from './pages/RepoListPage';
import RepoDetailPage from './pages/RepoDetailPage';
import SettingsPage from './pages/SettingsPage';
import { useRepoStore } from './store/repoStore';
import type { Repository } from './types';

type View = 'list' | 'detail' | 'settings';

export default function App() {
  const [view, setView] = useState<View>('list');
  const setActiveRepo = useRepoStore((s) => s.setActiveRepo);

  const handleOpenRepo = (repo: Repository) => {
    setActiveRepo(repo);
    setView('detail');
  };

  const handleNavigateHome = () => {
    setView('list');
  };

  const handleOpenSettings = () => {
    setView('settings');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: '#080e1a',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#e2e8f0',
      }}
    >
      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar — always visible */}
        <Sidebar
          onNavigateHome={handleNavigateHome}
          onOpenSettings={handleOpenSettings}
        />

        {/* Page content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {view === 'list' && (
            <RepoListPage onOpenRepo={handleOpenRepo} />
          )}
          {view === 'detail' && (
            <RepoDetailPage />
          )}
          {view === 'settings' && (
            <SettingsPage onClose={() => setView('list')} />
          )}
        </div>
      </div>

      {/* Status bar — always at the bottom */}
      <SyncBar />
    </div>
  );
}