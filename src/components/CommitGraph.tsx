import React, { useMemo } from 'react';
import type { CommitSummary } from '../types';

// ── Lane assignment ────────────────────────────────────────────────────────────
// Assigns each commit a column (lane) for the visual graph.
// This is a simplified version of git's graph algorithm.

const LANE_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ec4899',
  '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4',
];

interface GraphRow {
  commit: CommitSummary;
  lane: number;
  color: string;
  activeLanes: number[]; // lanes that are "open" at this row (have ongoing branches)
  mergeFrom?: number;    // lane that merges into this commit's lane
}

function buildGraph(commits: CommitSummary[]): GraphRow[] {
  if (commits.length === 0) return [];

  const rows: GraphRow[] = [];
  // map from oid -> lane index
  const oidToLane = new Map<string, number>();
  // which lanes are currently "open"
  const activeLanes: Set<number> = new Set();

  let nextLane = 0;

  for (const commit of commits) {
    // Determine this commit's lane
    let lane = oidToLane.get(commit.oid);
    if (lane === undefined) {
      // Find first free lane
      lane = nextLane++;
      while (activeLanes.has(lane)) lane = nextLane++;
    }

    activeLanes.add(lane);

    // Map each parent to a lane
    let mergeFrom: number | undefined;
    commit.parentOids.forEach((parentOid, idx) => {
      if (!oidToLane.has(parentOid)) {
        if (idx === 0) {
          oidToLane.set(parentOid, lane);
        } else {
          // Branch merge — assign a new lane
          const mergeLane = nextLane++;
          oidToLane.set(parentOid, mergeLane);
          activeLanes.add(mergeLane);
          mergeFrom = mergeLane;
        }
      } else if (idx > 0) {
        mergeFrom = oidToLane.get(parentOid);
      }
    });

    // If no parents (root commit), close the lane
    if (commit.parentOids.length === 0) {
      activeLanes.delete(lane);
    }

    rows.push({
      commit,
      lane,
      color: LANE_COLORS[lane % LANE_COLORS.length],
      activeLanes: [...activeLanes],
      mergeFrom,
    });
  }

  return rows;
}

// ── Rendering constants ────────────────────────────────────────────────────────
const ROW_H = 36;
const LANE_W = 16;
const DOT_R = 4;
const GRAPH_PAD = 10;

interface CommitGraphProps {
  commits: CommitSummary[];
  selectedOid: string | null;
  onSelect: (oid: string) => void;
}

export function CommitGraph({ commits, selectedOid, onSelect }: CommitGraphProps) {
  const rows = useMemo(() => buildGraph(commits), [commits]);

  const maxLane = rows.reduce((m, r) => Math.max(m, r.lane, ...r.activeLanes), 0);
  const graphWidth = GRAPH_PAD * 2 + (maxLane + 1) * LANE_W;

  if (rows.length === 0) {
    return (
      <div style={{ padding: 16, color: '#475569', fontSize: 13 }}>
        No commits yet.
      </div>
    );
  }

  return (
    <div style={{ overflowY: 'auto', flex: 1, position: 'relative' }}>
      <div style={{ display: 'flex' }}>
        {/* SVG graph column */}
        <svg
          width={graphWidth}
          height={rows.length * ROW_H}
          style={{ flexShrink: 0 }}
        >
          {rows.map((row, ri) => {
            const cx = GRAPH_PAD + row.lane * LANE_W;
            const cy = ri * ROW_H + ROW_H / 2;

            return (
              <g key={row.commit.oid}>
                {/* Vertical lines for active lanes */}
                {row.activeLanes.map((lane) => {
                  const lx = GRAPH_PAD + lane * LANE_W;
                  const color = LANE_COLORS[lane % LANE_COLORS.length];
                  // Don't draw line through the commit dot's lane at this row
                  if (lane === row.lane) {
                    return (
                      <g key={lane}>
                        {ri > 0 && (
                          <line
                            x1={lx} y1={(ri - 1) * ROW_H + ROW_H / 2 + DOT_R + 2}
                            x2={lx} y2={cy - DOT_R - 2}
                            stroke={color} strokeWidth={1.5} opacity={0.7}
                          />
                        )}
                        {ri < rows.length - 1 && (
                          <line
                            x1={lx} y1={cy + DOT_R + 2}
                            x2={lx} y2={(ri + 1) * ROW_H + ROW_H / 2}
                            stroke={color} strokeWidth={1.5} opacity={0.7}
                          />
                        )}
                      </g>
                    );
                  }
                  return (
                    <line
                      key={lane}
                      x1={lx} y1={ri * ROW_H}
                      x2={lx} y2={(ri + 1) * ROW_H}
                      stroke={color} strokeWidth={1.5} opacity={0.5}
                    />
                  );
                })}

                {/* Merge curve */}
                {row.mergeFrom !== undefined && (
                  <path
                    d={`M ${GRAPH_PAD + row.mergeFrom * LANE_W} ${cy}
                        C ${GRAPH_PAD + row.mergeFrom * LANE_W} ${cy - 12},
                          ${cx} ${cy - 12}, ${cx} ${cy}`}
                    fill="none"
                    stroke={row.color}
                    strokeWidth={1.5}
                    opacity={0.6}
                  />
                )}

                {/* Commit dot */}
                <circle
                  cx={cx} cy={cy} r={DOT_R}
                  fill={row.commit.oid === selectedOid ? row.color : '#0b1120'}
                  stroke={row.color}
                  strokeWidth={2}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelect(row.commit.oid)}
                />
              </g>
            );
          })}
        </svg>

        {/* Text column */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {rows.map((row) => {
            const isSelected = row.commit.oid === selectedOid;
            return (
              <div
                key={row.commit.oid}
                onClick={() => onSelect(row.commit.oid)}
                style={{
                  height: ROW_H,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 14px 0 8px',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(99,102,241,0.1)' : 'transparent',
                  borderBottom: '1px solid #0a1628',
                  gap: 8,
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: isSelected ? '#e2e8f0' : '#94a3b8',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {row.commit.message}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: 'monospace',
                    color: '#334155',
                    flexShrink: 0,
                  }}
                >
                  {row.commit.shortOid}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}