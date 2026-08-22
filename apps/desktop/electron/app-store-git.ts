import type {
  GitBlameLine,
  GitBlameResult,
  GitCommitDetailResult,
  GitCommitFileEntry,
  GitLogCommit,
  GitLogResult,
} from "../src/ipc";
import { executeGitCommand, type GitCommandOptions, type GitCommandResult } from "./app-store-diff";
import { resolveWorkspacePath } from "./workspace-paths";

const GIT_MAX_BUFFER = 20 * 1024 * 1024;

const SHA_PATTERN = /^[0-9a-f]{4,40}$/i;
const REF_NAME_PATTERN = /^[A-Za-z0-9._/-]+$/;

export async function getGitLog(
  workspacePath: string,
  limit = 500,
): Promise<GitLogResult> {
  let result: GitCommandResult;
  try {
    result = await executeGitCommand(
      [
        "log",
        "--all",
        "--date-order",
        `--max-count=${limit}`,
        "--pretty=format:%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%s%x1f%D%x1e",
      ],
      { cwd: workspacePath, maxBuffer: GIT_MAX_BUFFER },
    );
  } catch {
    return gitUnavailable("git-log-failed", "Git history is unavailable for this workspace.");
  }

  if (result.error) {
    return gitUnavailable("git-log-failed", "Git history is unavailable for this workspace.");
  }

  try {
    return { state: "ok", commits: parseGitLogOutput(result.stdout) };
  } catch {
    return gitUnavailable("git-log-invalid", "Git returned an unreadable commit log.");
  }
}

export function parseGitLogOutput(output: string): GitLogCommit[] {
  const commits: GitLogCommit[] = [];
  for (const rawRecord of output.split("\x1e")) {
    const record = rawRecord.replace(/^\n+/, "");
    if (record === "") {
      continue;
    }

    const fields = record.split("\x1f");
    if (fields.length < 7) {
      throw new Error("Malformed Git log record");
    }

    const [sha, parents, authorName, authorEmail, authorTimestamp, subject, decorations] = fields;
    if (!sha || !authorTimestamp || Number.isNaN(Number(authorTimestamp))) {
      throw new Error("Malformed Git log record");
    }

    commits.push({
      sha,
      parents: parents === "" ? [] : parents.split(" "),
      authorName: authorName ?? "",
      authorEmail: authorEmail ?? "",
      authorTimestamp: Number(authorTimestamp),
      subject: subject ?? "",
      decorations: decorations === "" ? [] : decorations.split(", ").filter(Boolean),
    });
  }
  return commits;
}

export async function getGitCommitDetail(
  workspacePath: string,
  sha: string,
): Promise<GitCommitDetailResult> {
  if (!SHA_PATTERN.test(sha)) {
    return gitUnavailable("invalid-commit-sha", "Commit details require a valid commit SHA.");
  }
  const options: GitCommandOptions = { cwd: workspacePath, maxBuffer: GIT_MAX_BUFFER };

  let metadata;
  let numstat;
  try {
    metadata = await executeGitCommand(
      ["show", "-s", "--format=%H%x1f%an%x1f%ae%x1f%at%x1f%s%x1f%b", sha],
      options,
    );
    // -c core.quotePath=false keeps non-ASCII file names readable (the default
    // escapes them as quoted C-style octal, which breaks the file list and any
    // follow-up pathspec lookups for those paths).
    numstat = await executeGitCommand(
      ["-c", "core.quotePath=false", "show", "--numstat", "--format=", "-M", sha],
      options,
    );
  } catch {
    return gitUnavailable("git-show-failed", "Commit details are unavailable for this workspace.");
  }

  if (metadata.error || numstat.error) {
    return gitUnavailable("git-show-failed", "Commit details are unavailable for this workspace.");
  }

  try {
    return parseGitCommitDetail(metadata.stdout, numstat.stdout);
  } catch {
    return gitUnavailable("git-show-invalid", "Git returned an unreadable commit.");
  }
}

export function parseGitCommitDetail(
  metadataOutput: string,
  numstatOutput: string,
): GitCommitDetailResult {
  const metadata = metadataOutput.replace(/\n$/, "").split("\x1f");
  if (metadata.length < 5) {
    throw new Error("Malformed Git commit metadata");
  }
  const [sha, authorName, authorEmail, authorTimestamp, subject] = metadata;
  if (!sha || !authorTimestamp || Number.isNaN(Number(authorTimestamp))) {
    throw new Error("Malformed Git commit metadata");
  }
  const body = metadata.slice(5).join("\x1f").replace(/^\n+/, "").replace(/\n+$/, "");

  return {
    state: "ok",
    sha,
    authorName: authorName ?? "",
    authorEmail: authorEmail ?? "",
    authorTimestamp: Number(authorTimestamp),
    subject: subject ?? "",
    body,
    files: parseGitNumstatOutput(numstatOutput),
  };
}

export function parseGitNumstatOutput(output: string): GitCommitFileEntry[] {
  const files: GitCommitFileEntry[] = [];
  for (const line of output.split("\n")) {
    if (line === "") {
      continue;
    }

    const firstTab = line.indexOf("\t");
    const secondTab = line.indexOf("\t", firstTab + 1);
    if (firstTab === -1 || secondTab === -1) {
      throw new Error("Malformed Git numstat record");
    }

    const additionsField = line.slice(0, firstTab);
    const deletionsField = line.slice(firstTab + 1, secondTab);
    const pathField = line.slice(secondTab + 1);
    const binary = additionsField === "-" || deletionsField === "-";

    const renamed = parseRenamedPath(pathField);
    files.push({
      ...(renamed === null ? { path: pathField } : { path: renamed.path }),
      ...(renamed === null ? {} : { oldPath: renamed.oldPath }),
      additions: binary ? null : Number(additionsField),
      deletions: binary ? null : Number(deletionsField),
      binary,
    });
  }
  return files;
}

function parseRenamedPath(
  pathField: string,
): { path: string; oldPath: string } | null {
  const arrowIndex = pathField.indexOf(" => ");
  if (arrowIndex === -1) {
    return null;
  }

  const openBrace = pathField.lastIndexOf("{", arrowIndex);
  const closeBrace = pathField.indexOf("}", arrowIndex);
  if (openBrace === -1 || closeBrace === -1 || closeBrace < openBrace) {
    return {
      path: pathField.slice(arrowIndex + 4),
      oldPath: pathField.slice(0, arrowIndex),
    };
  }

  const prefix = pathField.slice(0, openBrace);
  const suffix = pathField.slice(closeBrace + 1);
  return {
    path: `${prefix}${pathField.slice(arrowIndex + 4, closeBrace)}${suffix}`,
    oldPath: `${prefix}${pathField.slice(openBrace + 1, arrowIndex)}${suffix}`,
  };
}

export async function getGitCommitFileDiff(
  workspacePath: string,
  sha: string,
  filePath: string,
): Promise<string> {
  if (!SHA_PATTERN.test(sha)) {
    throw new Error("Commit file diff requires a valid commit SHA.");
  }
  resolveWorkspacePath(workspacePath, filePath);
  const result = await executeGitCommand(
    ["--literal-pathspecs", "show", "--format=", "--no-color", "-M", sha, "--", filePath],
    { cwd: workspacePath, maxBuffer: GIT_MAX_BUFFER },
  );
  if (result.error) {
    throw result.error;
  }
  return result.stdout;
}

export async function getGitBlame(
  workspacePath: string,
  filePath: string,
  ref?: string,
): Promise<GitBlameResult> {
  resolveWorkspacePath(workspacePath, filePath);
  if (ref !== undefined && !SHA_PATTERN.test(ref) && !REF_NAME_PATTERN.test(ref)) {
    return gitUnavailable("invalid-blame-ref", "Git blame requires a valid ref.");
  }

  let result: GitCommandResult;
  try {
    result = await executeGitCommand(
      [
        "--literal-pathspecs",
        "blame",
        "--porcelain",
        "-M",
        "-C",
        ...(ref === undefined ? [] : [ref]),
        "--",
        filePath,
      ],
      { cwd: workspacePath, maxBuffer: GIT_MAX_BUFFER },
    );
  } catch {
    return gitUnavailable("git-blame-failed", "Git blame is unavailable for this workspace.");
  }

  if (result.error) {
    return gitUnavailable("git-blame-failed", "Git blame is unavailable for this workspace.");
  }

  try {
    return { state: "ok", lines: parseGitBlamePorcelain(result.stdout) };
  } catch {
    return gitUnavailable("git-blame-invalid", "Git returned an unreadable blame.");
  }
}

const BLAME_HEADER_PATTERN = /^([0-9a-f]{40}) (\d+) (\d+)(?: (\d+))?$/;

export function parseGitBlamePorcelain(output: string): GitBlameLine[] {
  const lines: GitBlameLine[] = [];
  let current: {
    sha: string;
    origLine: number;
    finalLine: number;
    authorName: string;
    authorTimestamp: number;
    summary: string;
  } | null = null;

  for (const line of output.split("\n")) {
    if (line.startsWith("\t")) {
      if (current === null) {
        throw new Error("Git blame content line appeared before its header");
      }
      lines.push({
        sha: current.sha,
        authorName: current.authorName,
        authorTimestamp: current.authorTimestamp,
        summary: current.summary,
        origLine: current.origLine,
        finalLine: current.finalLine,
        lineText: line.slice(1),
      });
      current.origLine += 1;
      current.finalLine += 1;
      continue;
    }

    const headerMatch = BLAME_HEADER_PATTERN.exec(line);
    if (headerMatch) {
      current = {
        sha: headerMatch[1],
        origLine: Number(headerMatch[2]),
        finalLine: Number(headerMatch[3]),
        authorName: "",
        authorTimestamp: 0,
        summary: "",
      };
      continue;
    }

    if (current === null) {
      continue;
    }
    if (line.startsWith("author ")) {
      current.authorName = line.slice("author ".length);
    } else if (line.startsWith("author-time ")) {
      const authorTime = Number(line.slice("author-time ".length));
      if (!Number.isNaN(authorTime)) {
        current.authorTimestamp = authorTime;
      }
    } else if (line.startsWith("summary ")) {
      current.summary = line.slice("summary ".length);
    }
  }
  return lines;
}

function gitUnavailable(code: string, message: string) {
  return { state: "unavailable", error: { code, message } } as const;
}
