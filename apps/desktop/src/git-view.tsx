import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DiffModeEnum, DiffView } from "@git-diff-view/react";
import { getLang } from "@git-diff-view/file";
import { highlighter } from "@git-diff-view/lowlight";
import "@git-diff-view/react/styles/diff-view.css";
import {
  computeGitGraphLayout,
  gitEdgePath,
  GIT_LANE_COLOR_COUNT,
} from "./git-graph";
import {
  type GitBlameResult,
  type GitCommitDetailResult,
  type GitLogResult,
} from "./ipc";
import { useT } from "./i18n";
import { GitIcon } from "./icons";

const LOG_LIMIT = 500;
const GRAPH_LANE_WIDTH = 14;
const GRAPH_ROW_HEIGHT = 48;
const BLAME_LINE_LIMIT = 5000;

interface GitViewProps {
  readonly api: NonNullable<typeof window.piApp>;
  readonly workspaceId?: string;
  readonly resolvedTheme: "light" | "dark";
}

interface ActiveFile {
  readonly path: string;
  readonly oldPath?: string;
  readonly binary: boolean;
}

function formatTimestamp(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toLocaleString();
}

function hasUnifiedHunks(diffText: string): boolean {
  return /^@@ /m.test(diffText);
}

function isBinaryDiff(diffText: string): boolean {
  return /^Binary files .* differ$/m.test(diffText);
}
export function GitView({ api, workspaceId, resolvedTheme }: GitViewProps) {
  const t = useT();
  const [log, setLog] = useState<GitLogResult | null>(null);
  const [logPending, setLogPending] = useState(false);
  const [selectedSha, setSelectedSha] = useState("");
  const [detail, setDetail] = useState<GitCommitDetailResult | null>(null);
  const [activeFile, setActiveFile] = useState<ActiveFile | null>(null);
  const [fileMode, setFileMode] = useState<"diff" | "blame">("diff");
  const [diffText, setDiffText] = useState("");
  const [blame, setBlame] = useState<GitBlameResult | null>(null);
  const [filePending, setFilePending] = useState(false);
  const [diffViewMode, setDiffViewMode] = useState<DiffModeEnum>(DiffModeEnum.Split);
  const [wrap, setWrap] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedRef = useRef(false);
  const fileLoadTokenRef = useRef(0);
  const logLoadTokenRef = useRef(0);
  const detailLoadTokenRef = useRef(0);

  const loadLog = useCallback(
    (selectFirst: boolean) => {
      if (!workspaceId) {
        setLog(null);
        return;
      }
      const token = ++logLoadTokenRef.current;
      setLogPending(true);
      void api
        .getGitLog(workspaceId, LOG_LIMIT)
        .then((result) => {
          if (logLoadTokenRef.current !== token) {
            return;
          }
          setLog(result);
          if (selectFirst && result.state === "ok" && result.commits.length > 0 && result.commits[0]) {
            setSelectedSha(result.commits[0].sha);
          }
        })
        .catch(() => {
          if (logLoadTokenRef.current === token) {
            setLog({ state: "unavailable", error: { code: "git-log-failed", message: "Git history is unavailable for this workspace." } });
          }
        })
        .finally(() => {
          if (logLoadTokenRef.current === token) {
            setLogPending(false);
          }
        });
    },
    [api, workspaceId],
  );

  // Load commit history whenever the workspace changes.
  useEffect(() => {
    setLog(null);
    setDetail(null);
    setActiveFile(null);
    setDiffText("");
    setBlame(null);
    setSelectedSha("");
    loadLog(true);
  }, [loadLog]);

  // Load detail for the selected commit.
  useEffect(() => {
    setDetail(null);
    setActiveFile(null);
    setDiffText("");
    setBlame(null);
    if (!workspaceId || !selectedSha) {
      return;
    }
    const token = ++detailLoadTokenRef.current;
    void api
      .getGitCommitDetail(workspaceId, selectedSha)
      .then((result) => {
        if (detailLoadTokenRef.current === token) {
          setDetail(result);
        }
      })
      .catch(() => {
        if (detailLoadTokenRef.current === token) {
          setDetail({ state: "unavailable", error: { code: "git-detail-failed", message: "Commit details are unavailable for this workspace." } });
        }
      });
  }, [api, workspaceId, selectedSha]);

  // Load diff or blame for the active file.
  useEffect(() => {
    const token = ++fileLoadTokenRef.current;
    setDiffText("");
    setBlame(null);
    if (!workspaceId || !selectedSha || !activeFile) {
      return;
    }
    setFilePending(true);
    if (fileMode === "blame") {
      void api
        .getGitBlame(workspaceId, activeFile.path, selectedSha)
        .then((result) => {
          if (fileLoadTokenRef.current === token) {
            setBlame(result);
          }
        })
        .catch(() => {
          if (fileLoadTokenRef.current === token) {
            setBlame({ state: "unavailable", error: { code: "git-blame-failed", message: "Blame is unavailable for this file." } });
          }
        })
        .finally(() => {
          if (fileLoadTokenRef.current === token) {
            setFilePending(false);
          }
        });
      return;
    }
    void api
      .getGitCommitFileDiff(workspaceId, selectedSha, activeFile.path)
      .then((text) => {
        if (fileLoadTokenRef.current === token) {
          setDiffText(text);
        }
      })
      .catch(() => {
        if (fileLoadTokenRef.current === token) {
          setDiffText("");
        }
      })
      .finally(() => {
        if (fileLoadTokenRef.current === token) {
          setFilePending(false);
        }
      });
  }, [api, workspaceId, selectedSha, activeFile, fileMode]);

  const layout = useMemo(
    () => (log?.state === "ok" ? computeGitGraphLayout(log.commits) : null),
    [log],
  );

  const graphWidth = layout
    ? Math.max(layout.laneCount, 1) * GRAPH_LANE_WIDTH + 8
    : GRAPH_LANE_WIDTH + 8;

  const selectedParents = useMemo(
    () => layout?.rowsBySha.get(selectedSha)?.commit.parents ?? [],
    [layout, selectedSha],
  );

  const handleCopySha = () => {
    if (!selectedSha) {
      return;
    }
    void navigator.clipboard?.writeText(selectedSha).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  if (!workspaceId) {
    return <div className="git-view git-view--empty">{t("sidebar.noWorkspace")}</div>;
  }

  return (
    <div className="git-view" data-testid="git-view">
      <section className="git-view__log" data-testid="git-log">
        {logPending && !log ? <div className="git-view__hint">{t("git.loading")}</div> : null}
        {log?.state === "unavailable" ? (
          <div className="git-view__hint">{t("git.unavailable")}</div>
        ) : null}
        {log?.state === "ok" && log.commits.length === 0 ? (
          <div className="git-view__hint">{t("git.empty")}</div>
        ) : null}
        {layout && layout.rows.length > 0 ? (
          <div className="git-log">
            <svg
              className="git-log__graph"
              height={layout.rows.length * GRAPH_ROW_HEIGHT}
              width={graphWidth}
              aria-hidden="true"
            >
              {layout.rows.map((row) => {
                const childIndex = layout.rowsBySha.get(row.commit.sha)?.index ?? 0;
                const fromY = childIndex * GRAPH_ROW_HEIGHT + GRAPH_ROW_HEIGHT / 2;
                const fromX = row.lane * GRAPH_LANE_WIDTH + GRAPH_LANE_WIDTH / 2 + 4;
                return row.edges.map((edge, edgeIndex) => {
                  const parent = layout.rowsBySha.get(edge.parentSha);
                  const toX = parent
                    ? parent.lane * GRAPH_LANE_WIDTH + GRAPH_LANE_WIDTH / 2 + 4
                    : fromX;
                  const toY = parent
                    ? parent.index * GRAPH_ROW_HEIGHT + GRAPH_ROW_HEIGHT / 2
                    : fromY + GRAPH_ROW_HEIGHT;
                  return (
                    <path
                      className={`git-lane--${edge.colorIndex % GIT_LANE_COLOR_COUNT}`}
                      d={gitEdgePath(fromX, fromY, toX, toY)}
                      fill="none"
                      key={`${row.commit.sha}-${edgeIndex}`}
                      strokeWidth={2}
                    />
                  );
                });
              })}
              {layout.rows.map((row) => {
                const index = layout.rowsBySha.get(row.commit.sha)?.index ?? 0;
                return (
                  <circle
                    className={`git-lane--${row.colorIndex} git-log__dot${
                      row.commit.sha === selectedSha ? " git-log__dot--selected" : ""
                    }`}
                    cx={row.lane * GRAPH_LANE_WIDTH + GRAPH_LANE_WIDTH / 2 + 4}
                    cy={index * GRAPH_ROW_HEIGHT + GRAPH_ROW_HEIGHT / 2}
                    key={row.commit.sha}
                    r={4}
                  />
                );
              })}
            </svg>
            <ol className="git-log__list" data-testid="git-log-list">
              {layout.rows.map((row) => {
                const commit = row.commit;
                return (
                  <li key={commit.sha}>
                    <button
                      className={`git-log__row${
                        commit.sha === selectedSha ? " git-log__row--selected" : ""
                      }`}
                      data-testid="git-log-row"
                      onClick={() => setSelectedSha(commit.sha)}
                      style={{ height: GRAPH_ROW_HEIGHT }}
                      type="button"
                    >
                      <span aria-hidden="true" style={{ width: graphWidth, flex: "0 0 auto" }} />
                      <span className="git-log__cell">
                        <span className="git-log__subject">
                          {commit.decorations.length > 0 ? (
                            <span className="git-log__decorations">
                              {commit.decorations.map((decoration) => (
                                <span className="git-decoration" key={decoration}>
                                  {decoration}
                                </span>
                              ))}
                            </span>
                          ) : null}
                          <span className="git-log__subject-text">{commit.subject}</span>
                        </span>
                        <span className="git-log__meta">
                          <span className="git-log__author">{commit.authorName}</span>
                          <span className="git-log__sha">{commit.sha.slice(0, 7)}</span>
                          <span className="git-log__date">
                            {formatTimestamp(commit.authorTimestamp)}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
      </section>

      <section className="git-view__detail" data-testid="git-detail">
        {!selectedSha || !detail ? (
          <div className="git-view__hint">{t("git.selectCommit")}</div>
        ) : detail.state === "unavailable" ? (
          <div className="git-view__hint">{t("git.unavailable")}</div>
        ) : (
          <>
            <header className="git-detail__header">
              <h3 className="git-detail__subject">{detail.subject}</h3>
              {detail.body ? <pre className="git-detail__body">{detail.body}</pre> : null}
              <div className="git-detail__meta">
                <span className="git-detail__author">{detail.authorName}</span>
                <span className="git-detail__date">{formatTimestamp(detail.authorTimestamp)}</span>
                <button
                  className="git-detail__sha"
                  data-testid="git-detail-sha"
                  onClick={handleCopySha}
                  title={t("git.copySha")}
                  type="button"
                >
                  {detail.sha.slice(0, 7)}
                  {copied ? ` · ${t("git.copied")}` : ""}
                </button>
                <span className="git-detail__parents">
                  {(selectedParents.length > 1 ? t("git.parents") : t("git.parent")) + ":"}
                  {selectedParents.map((parent) => {
                    const known = layout?.rowsBySha.has(parent) ?? false;
                    return (
                      <button
                        className="git-detail__parent"
                        disabled={!known}
                        key={parent}
                        onClick={() => setSelectedSha(parent)}
                        type="button"
                      >
                        {parent.slice(0, 7)}
                      </button>
                    );
                  })}
                </span>
              </div>
            </header>

            <div className="git-detail__files" data-testid="git-file-list">
              {detail.files.map((file) => {
                const active = activeFile?.path === file.path;
                return (
                  <div
                    className={`git-file${active ? " git-file--active" : ""}`}
                    data-testid="git-file-row"
                    key={`${file.path}-${file.oldPath ?? ""}`}
                  >
                    <button
                      className="git-file__main"
                      onClick={() => {
                        setActiveFile({ path: file.path, oldPath: file.oldPath, binary: file.binary });
                        setFileMode("diff");
                      }}
                      type="button"
                    >
                      {file.additions !== null ? (
                        <span className="git-file__count git-file__count--add">+{file.additions}</span>
                      ) : null}
                      {file.deletions !== null ? (
                        <span className="git-file__count git-file__count--del">−{file.deletions}</span>
                      ) : null}
                      <span className="git-file__path">
                        {file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
                      </span>
                    </button>
                    <button
                      className="git-file__blame"
                      data-testid="git-file-blame"
                      onClick={() => {
                        setActiveFile({ path: file.path, oldPath: file.oldPath, binary: file.binary });
                        setFileMode("blame");
                      }}
                      title={t("git.blame")}
                      type="button"
                    >
                      {t("git.blame")}
                    </button>
                  </div>
                );
              })}
            </div>

            {activeFile ? (
              <div className="git-detail__content" data-testid="git-file-content">
                <div className="git-detail__toolbar">
                  <span className="git-detail__filename">{activeFile.path}</span>
                  <div className="git-detail__toolbar-actions">
                    {activeFile.binary ? null : (
                      <>
                        <button
                          className={`git-toolbar__toggle${diffViewMode === DiffModeEnum.Split && fileMode === "diff" ? " git-toolbar__toggle--active" : ""}`}
                          onClick={() => {
                            setFileMode("diff");
                            setDiffViewMode(DiffModeEnum.Split);
                          }}
                          type="button"
                        >
                          {t("git.splitView")}
                        </button>
                        <button
                          className={`git-toolbar__toggle${diffViewMode === DiffModeEnum.Unified && fileMode === "diff" ? " git-toolbar__toggle--active" : ""}`}
                          onClick={() => {
                            setFileMode("diff");
                            setDiffViewMode(DiffModeEnum.Unified);
                          }}
                          type="button"
                        >
                          {t("git.unifiedView")}
                        </button>
                        {fileMode === "diff" ? (
                          <button
                            className={`git-toolbar__toggle${wrap ? " git-toolbar__toggle--active" : ""}`}
                            onClick={() => setWrap((value) => !value)}
                            type="button"
                          >
                            {t("git.wrapLines")}
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
                {filePending ? <div className="git-view__hint">{t("git.loading")}</div> : null}
                {!filePending && fileMode === "diff" ? (
                  activeFile.binary ? (
                    <div className="git-view__hint">{t("git.binary")}</div>
                  ) : !hasUnifiedHunks(diffText) ? (
                    // Covers both empty diffs (pathspec matched nothing / mode-only
                    // change) and rare binary output the numstat flag missed —
                    // both render as the neutral "no changes shown" hint.
                    <div className="git-view__hint">
                      {isBinaryDiff(diffText) ? t("git.binary") : t("git.noDiff")}
                    </div>
                  ) : (
                    <div className="git-diff-scroll">
                      <DiffView
                        data={{
                          oldFile: {
                            fileName: activeFile.oldPath ?? activeFile.path,
                            fileLang: getLang(activeFile.oldPath ?? activeFile.path),
                          },
                          newFile: {
                            fileName: activeFile.path,
                            fileLang: getLang(activeFile.path),
                          },
                          // The full per-file diff text (header + hunks) is a single
                          // parser input: @git-diff-view's parser expects the ---/+++
                          // header lines before the @@ hunks.
                          hunks: diffText ? [diffText] : [],
                        }}
                        diffViewFontSize={13}
                        diffViewHighlight
                        diffViewMode={diffViewMode}
                        diffViewTheme={resolvedTheme}
                        diffViewWrap={wrap}
                        registerHighlighter={highlighter}
                      />
                    </div>
                  )
                ) : null}
                {!filePending && fileMode === "blame" ? (
                  blame == null ? null : blame.state === "unavailable" ? (
                    <div className="git-view__hint">{t("git.blameUnavailable")}</div>
                  ) : blame.lines.length === 0 ? (
                    <div className="git-view__hint">{t("git.noDiff")}</div>
                  ) : (
                    <div className="git-blame" data-testid="git-blame">
                      {blame.lines.length > BLAME_LINE_LIMIT ? (
                        <div className="git-view__hint">
                          {t("git.blameTruncated", { count: BLAME_LINE_LIMIT })}
                        </div>
                      ) : null}
                      {blame.lines.slice(0, BLAME_LINE_LIMIT).map((line, index, lines) => {
                        const previous = index > 0 ? lines[index - 1] : undefined;
                        const groupStart = previous?.sha !== line.sha;
                        return (
                          <div
                            className={`git-blame__row${groupStart ? " git-blame__row--group-start" : ""}`}
                            data-testid="git-blame-row"
                            key={line.finalLine}
                          >
                            <button
                              className="git-blame__sha"
                              onClick={() => setSelectedSha(line.sha)}
                              title={line.summary}
                              type="button"
                            >
                              {groupStart ? line.sha.slice(0, 7) : ""}
                            </button>
                            <span className="git-blame__author">{line.authorName}</span>
                            <span className="git-blame__date">
                              {new Date(line.authorTimestamp * 1000).toLocaleDateString()}
                            </span>
                            <span className="git-blame__num">{line.finalLine}</span>
                            <span className="git-blame__text">{line.lineText || " "}</span>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : null}
              </div>
            ) : (
              <div className="git-view__hint git-detail__placeholder">{t("git.selectFile")}</div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
