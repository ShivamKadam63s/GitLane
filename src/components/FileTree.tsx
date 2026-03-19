import React, { useState, useCallback } from 'react';
import type { TreeNode, FileStatusKind } from '../types';

const STATUS_COLORS: Record<FileStatusKind, string> = {
  modified: '#f59e0b',
  added: '#22c55e',
  deleted: '#ef4444',
  renamed: '#8b5cf6',
  copied: '#6366f1',
  untracked: '#94a3b8',
  conflicted: '#f43f5e',
};

const STATUS_LETTERS: Record<FileStatusKind, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  copied: 'C',
  untracked: '?',
  conflicted: '!',
};

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const icons: Record<string, string> = {
    ts: 'T', tsx: '⚛', js: 'J', jsx: '⚛', rs: 'R',
    json: '{}', md: '≡', css: '~', html: '<>', toml: '⚙',
    java: 'J', py: 'P', go: 'G', rb: 'R', cs: 'C',
  };
  return icons[ext] ?? '·';
}

// A node is "dirty" if it or any descendant has a status
function hasDirtyDescendant(node: TreeNode): boolean {
  if (node.statusKind) return true;
  return node.children?.some(hasDirtyDescendant) ?? false;
}

function TreeNodeRow({
  node,
  depth,
  selectedPath,
  onSelect,
  // defaultOpen: only top-level dirs (depth=0) are open by default
  defaultOpen,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isSelected = node.path === selectedPath;
  const isDir = node.kind === 'directory';
  const isDirty = hasDirtyDescendant(node);

  const handleClick = useCallback(() => {
    if (isDir) setOpen((o) => !o);
    else onSelect(node.path);
  }, [isDir, node.path, onSelect]);

  return (
    <>
      <div
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: `3px 12px 3px ${12 + depth * 14}px`,
          cursor: 'pointer',
          background: isSelected ? 'rgba(99,102,241,0.15)' : 'transparent',
          borderLeft: isSelected ? '2px solid #6366f1' : '2px solid transparent',
          fontSize: 13,
          color: isSelected ? '#e2e8f0' : '#94a3b8',
          userSelect: 'none',
          gap: 4,
        }}
      >
        {/* Expand/collapse arrow for dirs */}
        {isDir ? (
          <span style={{ fontSize: 9, color: '#475569', width: 10, flexShrink: 0 }}>
            {open ? '▼' : '▶'}
          </span>
        ) : (
          <span style={{ width: 10, flexShrink: 0 }} />
        )}

        {/* Icon */}
        {isDir ? (
          <span style={{ fontSize: 12, marginRight: 4 }}>{open ? '📂' : '📁'}</span>
        ) : (
          <span style={{
            fontSize: 10,
            color: '#475569',
            marginRight: 4,
            width: 14,
            display: 'inline-block',
            textAlign: 'center',
          }}>
            {fileIcon(node.name)}
          </span>
        )}

        {/* Name */}
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: node.statusKind
              ? STATUS_COLORS[node.statusKind]
              : isDir
              ? isDirty ? '#f59e0b' : '#cbd5e1'
              : undefined,
          }}
        >
          {node.name}
        </span>

        {/* Status badge */}
        {node.statusKind && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: STATUS_COLORS[node.statusKind],
              minWidth: 10,
              textAlign: 'right',
              flexShrink: 0,
            }}
          >
            {STATUS_LETTERS[node.statusKind]}
          </span>
        )}
        {/* Dirty bubble on directories */}
        {isDir && !node.statusKind && isDirty && (
          <span style={{ fontSize: 8, color: '#f59e0b', flexShrink: 0 }}>●</span>
        )}
      </div>

      {/* Children — only rendered when open */}
      {isDir && open && node.children?.map((child) => (
        <TreeNodeRow
          key={child.path}
          node={child}
          depth={depth + 1}
          selectedPath={selectedPath}
          onSelect={onSelect}
          // Only depth-0 children get defaultOpen=false — everything starts collapsed
          defaultOpen={false}
        />
      ))}
    </>
  );
}

interface FileTreeProps {
  nodes: TreeNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

export function FileTree({ nodes, selectedPath, onSelect }: FileTreeProps) {
  if (nodes.length === 0) {
    return (
      <div style={{ padding: 16, color: '#475569', fontSize: 12 }}>
        Loading files...
      </div>
    );
  }
  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {nodes.map((node) => (
        <TreeNodeRow
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
          // Only top-level directories start open
          defaultOpen={node.kind === 'directory'}
        />
      ))}
    </div>
  );
}