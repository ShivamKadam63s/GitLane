import React from 'react';
import type { Branch } from '../types';

interface BranchListProps {
  branches: Branch[];
  selectedName: string | null;
  onSelect: (name: string) => void;
  onSwitch: (name: string) => void;
  onDelete: (name: string) => void;
  onCreate: () => void;
}

export function BranchList({
  branches,
  selectedName,
  onSelect,
  onSwitch,
  onDelete,
  onCreate,
}: BranchListProps) {
  const local = branches.filter((b) => b.kind === 'local');
  const remote = branches.filter((b) => b.kind === 'remote');

  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {/* Toolbar */}
      <div
        style={{
          padding: '8px 14px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <button onClick={onCreate} style={actionBtnStyle}>
          + New branch
        </button>
      </div>

      <BranchGroup
        title="Local"
        branches={local}
        selectedName={selectedName}
        onSelect={onSelect}
        onSwitch={onSwitch}
        onDelete={onDelete}
      />

      {remote.length > 0 && (
        <BranchGroup
          title="Remote"
          branches={remote}
          selectedName={selectedName}
          onSelect={onSelect}
          onSwitch={onSwitch}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

function BranchGroup({
  title,
  branches,
  selectedName,
  onSelect,
  onSwitch,
  onDelete,
}: {
  title: string;
  branches: Branch[];
  selectedName: string | null;
  onSelect: (name: string) => void;
  onSwitch: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: '#475569',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding: '10px 14px 4px',
        }}
      >
        {title}
      </div>
      {branches.map((branch) => (
        <BranchRow
          key={branch.name}
          branch={branch}
          isSelected={branch.name === selectedName}
          onSelect={() => onSelect(branch.name)}
          onSwitch={() => onSwitch(branch.name)}
          onDelete={() => onDelete(branch.name)}
        />
      ))}
    </div>
  );
}

function BranchRow({
  branch,
  isSelected,
  onSelect,
  onSwitch,
  onDelete,
}: {
  branch: Branch;
  isSelected: boolean;
  onSelect: () => void;
  onSwitch: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        cursor: 'pointer',
        background: isSelected ? 'rgba(99,102,241,0.1)' : 'transparent',
        borderLeft: isSelected ? '2px solid #6366f1' : '2px solid transparent',
        borderBottom: '1px solid #0f172a',
      }}
    >
      {/* Current indicator dot */}
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: branch.isCurrent ? '#22c55e' : '#1e293b',
          border: `1.5px solid ${branch.isCurrent ? '#16a34a' : '#334155'}`,
          flexShrink: 0,
        }}
      />

      {/* Name */}
      <span
        style={{
          flex: 1,
          fontSize: 13,
          color: branch.isCurrent ? '#e2e8f0' : '#94a3b8',
          fontWeight: branch.isCurrent ? 500 : 400,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {branch.name}
      </span>

      {/* Ahead/behind */}
      {(branch.aheadCount > 0 || branch.behindCount > 0) && (
        <span style={{ fontSize: 11, color: '#475569', flexShrink: 0 }}>
          {branch.aheadCount > 0 && (
            <span style={{ color: '#818cf8' }}>↑{branch.aheadCount}</span>
          )}
          {branch.behindCount > 0 && (
            <span style={{ color: '#fb923c', marginLeft: 4 }}>
              ↓{branch.behindCount}
            </span>
          )}
        </span>
      )}

      {/* Actions (only show on hover via isSelected state) */}
      {isSelected && branch.kind === 'local' && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {!branch.isCurrent && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSwitch();
              }}
              style={actionBtnStyle}
              title="Switch to this branch"
            >
              checkout
            </button>
          )}
          {!branch.isCurrent && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              style={{ ...actionBtnStyle, color: '#ef4444', borderColor: '#7f1d1d' }}
              title="Delete branch"
            >
              delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #1e293b',
  borderRadius: 5,
  color: '#64748b',
  fontSize: 11,
  padding: '3px 8px',
  cursor: 'pointer',
};