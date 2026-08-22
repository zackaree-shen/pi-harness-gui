import type { GitLogCommit } from "./ipc";

/** Number of distinct lane colors (CSS classes .git-lane--0 .. .git-lane--7). */
export const GIT_LANE_COLOR_COUNT = 8;

export interface GitGraphEdge {
  /** Parent commit sha this edge points to. */
  readonly parentSha: string;
  /** Lane (x position) of the child commit when it was processed. */
  readonly childLane: number;
  /** Color index for the edge (child's lane color, gitk convention). */
  readonly colorIndex: number;
}

export interface GitGraphRow {
  readonly commit: GitLogCommit;
  /** Lane index for the commit dot. */
  readonly lane: number;
  readonly colorIndex: number;
  /** Edges from this commit down to its parents. */
  readonly edges: readonly GitGraphEdge[];
}

export interface GitGraphLayout {
  readonly rows: readonly GitGraphRow[];
  /** Index by sha for O(1) lookup of row position/lane. */
  readonly rowsBySha: ReadonlyMap<string, GitGraphRow & { index: number }>;
  /** Total lane count needed (SVG width = laneCount * laneWidth). */
  readonly laneCount: number;
}

/**
 * Assign commits (git log --date-order, newest first) to graph lanes using the
 * classic gitk algorithm: the first parent inherits the child's lane, extra
 * parents open new lanes at the tail, and empty lanes are compacted away.
 */
export function computeGitGraphLayout(commits: readonly GitLogCommit[]): GitGraphLayout {
  // lanes[i] = sha of the tip currently parked in lane i (null = pending removal).
  const lanes: (string | null)[] = [];
  const rows: GitGraphRow[] = [];

  for (const commit of commits) {
    let lane = lanes.indexOf(commit.sha);
    if (lane === -1) {
      // Defensive: commit not reachable from any tracked tip (should not happen
      // with --date-order, but keep the graph coherent if it does).
      lanes.push(commit.sha);
      lane = lanes.length - 1;
    }
    const childLane = lane;
    const colorIndex = childLane % GIT_LANE_COLOR_COUNT;

    const edges: GitGraphEdge[] = commit.parents.map((parentSha) => ({
      parentSha,
      childLane,
      colorIndex,
    }));

    // First parent continues in this lane; others open new lanes.
    const [firstParent, ...restParents] = commit.parents;
    lanes[childLane] = firstParent ?? null;
    for (const parent of restParents) {
      if (!lanes.includes(parent)) {
        lanes.push(parent);
      }
    }

    rows.push({ commit, lane: childLane, colorIndex, edges });

    // Compact: drop finished lanes so the graph narrows again.
    for (let i = lanes.length - 1; i >= 0; i -= 1) {
      if (lanes[i] === null) {
        lanes.splice(i, 1);
      }
    }
  }

  let laneCount = 0;
  const rowsBySha = new Map<string, GitGraphRow & { index: number }>();
  rows.forEach((row, index) => {
    rowsBySha.set(row.commit.sha, { ...row, index });
    laneCount = Math.max(laneCount, row.lane + 1);
    for (const edge of row.edges) {
      const parent = rowsBySha.get(edge.parentSha);
      if (parent) {
        laneCount = Math.max(laneCount, parent.lane + 1);
      }
    }
  });
  laneCount = Math.max(laneCount, 1);

  return { rows, rowsBySha, laneCount };
}

/** Bezier path from a child dot down to its parent dot (gitk-style curves). */
export function gitEdgePath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): string {
  const midY = (fromY + toY) / 2;
  return `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;
}
