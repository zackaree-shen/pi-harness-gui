import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import {
  getGitBlame,
  getGitCommitDetail,
  getGitCommitFileDiff,
  getGitLog,
  parseGitBlamePorcelain,
  parseGitCommitDetail,
  parseGitLogOutput,
  parseGitNumstatOutput,
} from "../../electron/app-store-git";

const execFileAsync = promisify(execFile);

test("parses git log records including merge parents and decorations", async () => {
  const workspacePath = await setupRepository("pi-gui-git-log-");
  try {
    await commitFile(workspacePath, "base.txt", "base\n", "base commit");
    const baseSha = await headSha(workspacePath);
    await runGit(workspacePath, ["branch", "feature"]);
    await runGit(workspacePath, ["tag", "v1.0"]);
    await commitFile(workspacePath, "main-file.txt", "main\n", "main commit");
    await runGit(workspacePath, ["checkout", "-q", "feature"]);
    await commitFile(workspacePath, "feature-file.txt", "feature\n", "feature commit");
    await runGit(workspacePath, ["checkout", "-q", "main"]);
    await runGit(workspacePath, ["merge", "--no-ff", "-m", "merge feature", "feature"]);

    const result = await getGitLog(workspacePath);
    expect(result.state).toBe("ok");
    if (result.state !== "ok") {
      return;
    }

    const commits = result.commits;
    expect(commits.length).toBe(4);

    const merge = commits[0];
    expect(merge.parents.length).toBe(2);
    expect(merge.subject).toBe("merge feature");
    expect(merge.decorations).toContain("HEAD -> main");

    const mainCommit = commits.find((commit) => commit.subject === "main commit");
    expect(mainCommit).toBeDefined();
    expect(mainCommit?.parents).toEqual([baseSha]);
    expect(mainCommit?.authorName).toBe("Pi App Tests");
    expect(mainCommit?.authorEmail).toBe("pi-gui-tests@example.com");
    expect(mainCommit?.authorTimestamp).toBeGreaterThan(0);

    const featureCommit = commits.find((commit) => commit.subject === "feature commit");
    expect(featureCommit).toBeDefined();

    const base = commits.find((commit) => commit.sha === baseSha);
    expect(base?.parents).toEqual([]);
    expect(base?.decorations).toContain("tag: v1.0");
  } finally {
    await rm(workspacePath, { recursive: true, force: true });
  }
});

test("parses log output with empty decorations for undecorated commits", () => {
  const output = [
    "def456\x1fabc123\x1fAlice\x1falice@example.com\x1f1750000000\x1fsecond\x1f\x1e",
    "\nabc123\x1f\x1fBob\x1fbob@example.com\x1f1749900000\x1froot\x1fHEAD -> main\x1e",
  ].join("");
  expect(parseGitLogOutput(output)).toEqual([
    {
      sha: "def456",
      parents: ["abc123"],
      authorName: "Alice",
      authorEmail: "alice@example.com",
      authorTimestamp: 1750000000,
      subject: "second",
      decorations: [],
    },
    {
      sha: "abc123",
      parents: [],
      authorName: "Bob",
      authorEmail: "bob@example.com",
      authorTimestamp: 1749900000,
      subject: "root",
      decorations: ["HEAD -> main"],
    },
  ]);
});

test("returns unavailable when git log fails outside a repository", async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), "pi-gui-not-a-repo-"));
  try {
    const result = await getGitLog(workspacePath);
    expect(result).toEqual({
      state: "unavailable",
      error: {
        code: "git-log-failed",
        message: "Git history is unavailable for this workspace.",
      },
    });
  } finally {
    await rm(workspacePath, { recursive: true, force: true });
  }
});

test("reads commit detail metadata, binary entries, and renames", async () => {
  const workspacePath = await setupRepository("pi-gui-git-detail-");
  try {
    await commitFile(workspacePath, "notes.txt", "v1\n", "base");
    await writeFile(
      join(workspacePath, "blob.bin"),
      Buffer.concat([Buffer.from("BIN\u0000\u0001"), Buffer.alloc(4)]),
    );
    await runGit(workspacePath, ["add", "--", "blob.bin"]);
    await runGit(workspacePath, ["commit", "-m", "add binary"]);
    await mkdir(join(workspacePath, "docs"));
    await runGit(workspacePath, ["mv", "--", "notes.txt", "docs/notes.txt"]);await runGit(workspacePath, ["commit", "-m", "rename notes"]);
    const renameSha = await headSha(workspacePath);
    const rootSha = await parentSha(workspacePath, "HEAD");

    const renameDetail = await getGitCommitDetail(workspacePath, renameSha);
    expect(renameDetail.state).toBe("ok");
    if (renameDetail.state !== "ok") {
      return;
    }
    expect(renameDetail.sha).toBe(renameSha);
    expect(renameDetail.subject).toBe("rename notes");
    expect(renameDetail.body).toBe("");
    expect(renameDetail.authorName).toBe("Pi App Tests");
    expect(renameDetail.files.length).toBe(1);
    expect(renameDetail.files[0]?.path).toBe("docs/notes.txt");
    expect(renameDetail.files[0]?.oldPath).toBe("notes.txt");
    expect(renameDetail.files[0]?.additions).toBe(0);
    expect(renameDetail.files[0]?.deletions).toBe(0);
    expect(renameDetail.files[0]?.binary).toBe(false);

    const rootDetail = await getGitCommitDetail(workspacePath, rootSha);
    expect(rootDetail.state).toBe("ok");
    if (rootDetail.state !== "ok") {
      return;
    }
    expect(rootDetail.subject).toBe("add binary");
    const binaryEntry = rootDetail.files.find((file) => file.path === "blob.bin");
    expect(binaryEntry).toEqual({
      path: "blob.bin",
      additions: null,
      deletions: null,
      binary: true,
    });
  } finally {
    await rm(workspacePath, { recursive: true, force: true });
  }
});

test("parses numstat rename forms and multi-line commit bodies", () => {
  const numstat = [
    "5\t2\tREADME.md",
    "-\t-\tlogo.png",
    "1\t0\tsrc/{old-name.ts => new-name.ts}",
    "3\t1\told-full.txt => nested/new-full.txt",
  ].join("\n");
  expect(parseGitNumstatOutput(numstat)).toEqual([
    { path: "README.md", additions: 5, deletions: 2, binary: false },
    { path: "logo.png", additions: null, deletions: null, binary: true },
    { path: "src/new-name.ts", oldPath: "src/old-name.ts", additions: 1, deletions: 0, binary: false },
    { path: "nested/new-full.txt", oldPath: "old-full.txt", additions: 3, deletions: 1, binary: false },
  ]);

  const detail = parseGitCommitDetail(
    "abc123\x1fAlice\x1falice@example.com\x1f1750000000\x1fsubject line\x1f\nbody line one\nbody line two\n",
    "",
  );
  expect(detail.state).toBe("ok");
  if (detail.state !== "ok") {
    return;
  }
  expect(detail.body).toBe("body line one\nbody line two");
});

test("parses numstat output with non-ASCII file names (quotePath disabled)", () => {
  // With `-c core.quotePath=false` git emits raw UTF-8 paths; the parser must
  // keep them intact for later pathspec lookups (diff/blame).
  const numstat = [
    "10\t0\tREADME.md",
    "2\t1\t\u4e2d\u6587\u6587\u4ef6\u540d.ts",
    "1\t1\t\u65e7\u540d\u5b57.ts => \u65b0\u540d\u5b57.ts",
  ].join("\n");
  expect(parseGitNumstatOutput(numstat)).toEqual([
    { path: "README.md", additions: 10, deletions: 0, binary: false },
    { path: "\u4e2d\u6587\u6587\u4ef6\u540d.ts", additions: 2, deletions: 1, binary: false },
    {
      path: "\u65b0\u540d\u5b57.ts",
      oldPath: "\u65e7\u540d\u5b57.ts",
      additions: 1,
      deletions: 1,
      binary: false,
    },
  ]);
});

test("rejects malformed commit SHAs before running git", async () => {
  const detail = await getGitCommitDetail("/workspace", "--output=evil");
  expect(detail).toEqual({
    state: "unavailable",
    error: {
      code: "invalid-commit-sha",
      message: "Commit details require a valid commit SHA.",
    },
  });
  await expect(getGitCommitFileDiff("/workspace", "zz..", "file.txt")).rejects.toThrow(
    "Commit file diff requires a valid commit SHA.",
  );
});

test("returns unified diff text for a commit file, including the root commit", async () => {
  const workspacePath = await setupRepository("pi-gui-git-file-diff-");
  try {
    await commitFile(workspacePath, "alpha.txt", "line 1\nline 2\n", "root");
    const rootSha = await headSha(workspacePath);
    await commitFile(workspacePath, "alpha.txt", "line 1\nline 2 changed\n", "edit");
    const editSha = await headSha(workspacePath);

    const rootDiff = await getGitCommitFileDiff(workspacePath, rootSha, "alpha.txt");
    expect(rootDiff).toContain("+++");
    expect(rootDiff).toContain("@@");
    expect(rootDiff).toContain("line 1");

    const editDiff = await getGitCommitFileDiff(workspacePath, editSha, "alpha.txt");
    expect(editDiff).toContain("-line 2");
    expect(editDiff).toContain("+line 2 changed");
  } finally {
    await rm(workspacePath, { recursive: true, force: true });
  }
});

test("blames lines with author, summary, and stable ordering", async () => {
  const workspacePath = await setupRepository("pi-gui-git-blame-");
  try {
    await commitFile(workspacePath, "story.txt", "first line\n", "first");
    await runGit(workspacePath, ["tag", "v0"]);
    await runGit(workspacePath, ["config", "user.name", "Second Author"]);
    await writeFile(join(workspacePath, "story.txt"), "first line\nsecond line\n", "utf8");
    await runGit(workspacePath, ["add", "--", "story.txt"]);
    await runGit(workspacePath, ["commit", "-m", "second"]);
    const firstSha = await parentSha(workspacePath, "HEAD");
    const secondSha = await headSha(workspacePath);

    const result = await getGitBlame(workspacePath, "story.txt");
    expect(result.state).toBe("ok");
    if (result.state !== "ok") {
      return;
    }

    expect(result.lines.length).toBe(2);
    const [first, second] = result.lines;
    expect(first?.sha).toBe(firstSha);
    expect(first?.authorName).toBe("Pi App Tests");
    expect(first?.summary).toBe("first");
    expect(first?.lineText).toBe("first line");
    expect(first?.origLine).toBe(1);
    expect(first?.finalLine).toBe(1);
    expect(second?.sha).toBe(secondSha);
    expect(second?.authorName).toBe("Second Author");
    expect(second?.summary).toBe("second");
    expect(second?.lineText).toBe("second line");
    expect(second?.origLine).toBe(2);
    expect(second?.finalLine).toBe(2);

    const blamedAtRef = await getGitBlame(workspacePath, "story.txt", "v0");
    expect(blamedAtRef.state).toBe("ok");
    if (blamedAtRef.state === "ok") {
      expect(blamedAtRef.lines.length).toBe(1);
      expect(blamedAtRef.lines[0]?.lineText).toBe("first line");
    }
  } finally {
    await rm(workspacePath, { recursive: true, force: true });
  }
});

test("parses blame porcelain output with grouped consecutive lines", () => {
  const sha1 = "a".repeat(40);
  const sha2 = "b".repeat(40);
  const output = [
    `${sha1} 1 1 2`,
    `author Alice`,
    `author-time 1750000000`,
    `summary initial commit`,
    `\tline A`,
    `\tline B`,
    `${sha2} 5 3`,
    `author Bob`,
    `author-time 1750001000`,
    `summary follow up`,
    `filename story.txt`,
    `\tline C`,
    `${sha1} 2 4`,
    `author Alice`,
    `author-time 1750000000`,
    `summary initial commit`,
    `\tline D`,
  ].join("\n");
  const lines = parseGitBlamePorcelain(output);
  expect(lines).toEqual([
    { sha: sha1, authorName: "Alice", authorTimestamp: 1750000000, summary: "initial commit", origLine: 1, finalLine: 1, lineText: "line A" },
    { sha: sha1, authorName: "Alice", authorTimestamp: 1750000000, summary: "initial commit", origLine: 2, finalLine: 2, lineText: "line B" },
    { sha: sha2, authorName: "Bob", authorTimestamp: 1750001000, summary: "follow up", origLine: 5, finalLine: 3, lineText: "line C" },
    { sha: sha1, authorName: "Alice", authorTimestamp: 1750000000, summary: "initial commit", origLine: 2, finalLine: 4, lineText: "line D" },
  ]);
});

test("rejects blame refs that could inject git options", async () => {
  const result = await getGitBlame("/workspace", "file.txt", "--output=x");
  expect(result).toEqual({
    state: "unavailable",
    error: {
      code: "invalid-blame-ref",
      message: "Git blame requires a valid ref.",
    },
  });
});

async function setupRepository(prefix: string): Promise<string> {
  const workspacePath = await mkdtemp(join(tmpdir(), prefix));
  await runGit(workspacePath, ["init", "-b", "main"]);
  await runGit(workspacePath, ["config", "user.name", "Pi App Tests"]);
  await runGit(workspacePath, ["config", "user.email", "pi-gui-tests@example.com"]);
  return workspacePath;
}

async function commitFile(
  workspacePath: string,
  filePath: string,
  contents: string,
  message: string,
): Promise<void> {
  await writeFile(join(workspacePath, filePath), contents, "utf8");
  await runGit(workspacePath, ["add", "--", filePath]);
  await runGit(workspacePath, ["commit", "-m", message]);
}

async function headSha(workspacePath: string): Promise<string> {
  return (await runGit(workspacePath, ["rev-parse", "HEAD"])).trim();
}

async function parentSha(workspacePath: string, ref: string): Promise<string> {
  return (await runGit(workspacePath, ["rev-parse", `${ref}^`])).trim();
}

async function runGit(workspacePath: string, args: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", [...args], {
    cwd: workspacePath,
    maxBuffer: 2 * 1024 * 1024,
  });
  return stdout;
}
