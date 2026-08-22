import { expect, test } from "@playwright/test";
import { computeGitGraphLayout } from "../../src/git-graph";
import type { GitLogCommit } from "../../src/ipc";

function commit(sha: string, parents: string[]): GitLogCommit {
  return {
    sha,
    parents,
    authorName: "a",
    authorEmail: "a@example.com",
    authorTimestamp: 0,
    subject: sha,
    decorations: [],
  };
}

function run(commits: GitLogCommit[]) {
  return computeGitGraphLayout(commits);
}

test("linear history stays on one lane", () => {
  const layout = run([commit("c3", ["c2"]), commit("c2", ["c1"]), commit("c1", [])]);
  expect(layout.rows.map((row) => row.lane)).toEqual([0, 0, 0]);
  expect(layout.laneCount).toBe(1);
});

test("branch opens a second lane and merge converges", () => {
  // main: m0 <- m1 <- m2(merge) ; feature: m0 <- f1
  const layout = run([
    commit("m2", ["m1", "f1"]),
    commit("f1", ["m0"]),
    commit("m1", ["m0"]),
    commit("m0", []),
  ]);
  const lanes = layout.rows.map((row) => row.commit.sha);
  expect(lanes).toEqual(["m2", "f1", "m1", "m0"]);
  const bySha = new Map(layout.rows.map((row) => [row.commit.sha, row.lane]));
  expect(bySha.get("m2")).toBe(0);
  expect(bySha.get("f1")).toBe(1);
  // After the merge, m1 and m0 collapse back to lane 0 (single lane).
  expect(bySha.get("m1")).toBe(0);
  expect(bySha.get("m0")).toBe(0);
  expect(layout.laneCount).toBe(2);
});

test("octopus merge fans parents out then collapses", () => {
  const layout = run([
    commit("o", ["p", "a", "b"]),
    commit("b", ["p"]),
    commit("a", ["p"]),
    commit("p", []),
  ]);
  const bySha = new Map(layout.rows.map((row) => [row.commit.sha, row.lane]));
  expect(bySha.get("o")).toBe(0);
  expect(bySha.get("a")).toBe(1);
  expect(bySha.get("b")).toBe(2);
  // Everything collapses to one lane once all branches merge.
  expect(bySha.get("p")).toBe(0);
  expect(layout.laneCount).toBe(3);
});

test("two independent roots never share a lane", () => {
  const layout = run([commit("x", ["x0"]), commit("y", ["y0"]), commit("y0", []), commit("x0", [])]);
  const bySha = new Map(layout.rows.map((row) => [row.commit.sha, row.lane]));
  expect(bySha.get("x")).not.toBe(bySha.get("y"));
  expect(layout.laneCount).toBeGreaterThanOrEqual(2);
});

test("edges reference parent lanes", () => {
  const layout = run([
    commit("m2", ["m1", "f1"]),
    commit("f1", ["m0"]),
    commit("m1", ["m0"]),
    commit("m0", []),
  ]);
  const merge = layout.rows[0]!;
  expect(merge.edges.map((edge) => edge.parentSha)).toEqual(["m1", "f1"]);
  // Edge from m2 (lane 0) curves to f1 (lane 1).
  const f1 = layout.rowsBySha.get("f1")!;
  expect(merge.edges[1]!.childLane).toBe(0);
  expect(f1.lane).toBe(1);
});
