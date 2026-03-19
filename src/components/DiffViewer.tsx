import React, { useEffect, useState } from 'react';
import type { FileChange, HunkLine } from '../types';
import { getFileContent } from '../lib/git/diff';

function LineNo({ n }: { n?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 40,
        textAlign: 'right',
        paddingRight: 10,
        color: '#334155',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {n ?? ''}
    </span>
  );
}

function DiffLine({ line }: { line: HunkLine }) {
  const bg =
    line.kind === 'addition'
      ? 'rgba(34,197,94,0.08)'
      : line.kind === 'deletion'
      ? 'rgba(239,68,68,0.08)'
      : 'transparent';

  const color =
    line.kind === 'addition'
      ? '#86efac'
      : line.kind === 'deletion'
      ? '#fca5a5'
      : '#64748b';

  const prefix =
    line.kind === 'addition' ? '+' : line.kind === 'deletion' ? '-' : ' ';

  return (
    <div style={{ display: 'flex', background: bg, minHeight: 20, lineHeight: '20px' }}>
      <LineNo n={line.oldLineNo} />
      <LineNo n={line.newLineNo} />
      <span
        style={{
          color,
          fontFamily: 'monospace',
          fontSize: 12,
          whiteSpace: 'pre',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {prefix}{line.content}
      </span>
    </div>
  );
}

// ── Plain file viewer (for clean files with no diff) ──────────────────────────
function FileContentViewer({
  repoPath,
  filePath,
}: {
  repoPath: string;
  filePath: string;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getFileContent(repoPath, filePath, 'WORKDIR')
      .then((c) => { setContent(c); setLoading(false); })
      .catch((e) => { setError(e.toString()); setLoading(false); });
  }, [repoPath, filePath]);

  if (loading) return <div style={centerStyle}><span style={hintStyle}>Loading...</span></div>;
  if (error) return <div style={centerStyle}><span style={{ color: '#ef4444', fontSize: 13 }}>{error}</span></div>;

  const lines = (content ?? '').split('\n');
  return (
    <div style={{ overflowY: 'auto', flex: 1, background: '#080e1a' }}>
      <div
        style={{
          padding: '6px 14px',
          borderBottom: '1px solid #1e293b',
          fontSize: 12,
          fontFamily: 'monospace',
          color: '#475569',
          background: '#0b1120',
          position: 'sticky',
          top: 0,
        }}
      >
        {filePath} — no changes (clean)
      </div>
      <div style={{ padding: '0 14px' }}>
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'flex', minHeight: 20, lineHeight: '20px' }}>
            <span
              style={{
                display: 'inline-block',
                width: 40,
                textAlign: 'right',
                paddingRight: 10,
                color: '#1e3a5f',
                userSelect: 'none',
                flexShrink: 0,
                fontSize: 11,
              }}
            >
              {i + 1}
            </span>
            <span
              style={{
                color: '#475569',
                fontFamily: 'monospace',
                fontSize: 12,
                whiteSpace: 'pre',
              }}
            >
              {line}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface DiffViewerProps {
  fileChange: FileChange | null;
  isLoading?: boolean;
  // When a clean file is selected (no diff), show its raw content instead
  repoPath?: string | null;
  selectedFilePath?: string | null;
}

export function DiffViewer({ fileChange, isLoading, repoPath, selectedFilePath }: DiffViewerProps) {
  if (isLoading) {
    return <div style={centerStyle}><span style={hintStyle}>Loading diff...</span></div>;
  }

  // No file selected at all
  if (!selectedFilePath) {
    return (
      <div style={centerStyle}>
        <span style={hintStyle}>Select a file to view its contents</span>
      </div>
    );
  }

  // File is selected but has no diff — show raw content
  if (!fileChange || fileChange.hunks.length === 0) {
    if (repoPath) {
      return <FileContentViewer repoPath={repoPath} filePath={selectedFilePath} />;
    }
    return <div style={centerStyle}><span style={hintStyle}>File is unchanged</span></div>;
  }

  if (fileChange.isBinary) {
    return <div style={centerStyle}><span style={hintStyle}>Binary file — no diff available</span></div>;
  }

  return (
    <div style={{ overflowY: 'auto', flex: 1, background: '#080e1a' }}>
      {/* File header */}
      <div
        style={{
          padding: '8px 14px',
          borderBottom: '1px solid #1e293b',
          fontSize: 12,
          fontFamily: 'monospace',
          color: '#94a3b8',
          background: '#0b1120',
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        {fileChange.oldPath && fileChange.oldPath !== fileChange.path
          ? `${fileChange.oldPath} → ${fileChange.path}`
          : fileChange.path}
      </div>

      {fileChange.hunks.map((hunk, hi) => (
        <div key={hi}>
          <div
            style={{
              padding: '4px 14px',
              background: 'rgba(99,102,241,0.08)',
              borderTop: hi > 0 ? '1px solid #1e293b' : undefined,
              fontSize: 11,
              fontFamily: 'monospace',
              color: '#6366f1',
            }}
          >
            {hunk.header}
          </div>
          <div style={{ padding: '0 14px' }}>
            {hunk.lines.map((line, li) => (
              <DiffLine key={li} line={line} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const centerStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const hintStyle: React.CSSProperties = {
  color: '#334155',
  fontSize: 13,
};