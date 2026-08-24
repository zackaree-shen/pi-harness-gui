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

const LOG_LIMIT = 500;
const GRAPH_LANE_WIDTH = 12;
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

function formatRelativeTime(timestampSeconds: number): string {
  const deltaSeconds = Date.now() / 1000 - timestampSeconds;
  const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (deltaSeconds < 60) {
    return relative.format(-Math.round(deltaSeconds), "second");
  }
  if (deltaSeconds < 3600) {
    return relative.format(-Math.round(deltaSeconds / 60), "minute");
  }
  if (deltaSeconds < 86400) {
    return relative.format(-Math.round(deltaSeconds / 3600), "hour");
  }
  if (deltaSeconds < 7 * 86400) {
    return relative.format(-Math.round(deltaSeconds / 86400), "day");
  }
  return new Date(timestampSeconds * 1000).toLocaleDateString();
}

function splitPath(path: string): { dir: string; base: string } {
  const index = path.lastIndexOf("/");
  return index === -1
    ? { dir: "", base: path }
    : { dir: path.slice(0, index + 1), base: path.slice(index + 1) };
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
  const [navLevel, setNavLevel] = useState<"history" | "files">("history");
  const [detail, setDetail] = useState<GitCommitDetailResult | null>(null);
  const [detailPending, setDetailPending] = useState(false);
  const [activeFile, setActiveFile] = useState<ActiveFile | null>(null);
  const [fileMode, setFileMode] = useState<"diff" | "blame">("diff");
  const [diffText, setDiffText] = useState("");
  const [blame, setBlame] = useState<GitBlameResult | null>(null);
  const [filePending, setFilePending] = useState(false);
  const [diffViewMode, setDiffViewMode] = useState<DiffModeEnum>(DiffModeEnum.Split);
  const [wrap, setWrap] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const copiedRef = useRef(false);
  const fileLoadTokenRef = useRef(0);
  const logLoadTokenRef = useRef(0);
  const detailLoadTokenRef = useRef(0);
  const sidebarBodyRef = useRef<HTMLDivElement | null>(null);
  const historyScrollRef = useRef(0);
  const resizeDragRef = useRef<{ startX: number; startWidth: number } | null>(null);

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
    setNavLevel("history");
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
    setDetailPending(true);
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
      })
      .finally(() => {
        if (detailLoadTokenRef.current === token) {
          setDetailPending(false);
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

  const selectCommit = useCallback((sha: string) => {
    historyScrollRef.current = sidebarBodyRef.current?.scrollTop ?? 0;
    setSelectedSha(sha);
    setNavLevel("files");
  }, []);

  const goBackToHistory = useCallback(() => {
    setActiveFile(null);
    setFileMode("diff");
    setNavLevel("history");
  }, []);

  // Keep per-level scroll positions: history restores its saved offset, files starts at the top.
  useEffect(() => {
    if (!sidebarBodyRef.current) {
      return;
    }
    if (navLevel === "history") {
      sidebarBodyRef.current.scrollTop = historyScrollRef.current;
    } else {
      sidebarBodyRef.current.scrollTop = 0;
    }
  }, [navLevel, log, sidebarCollapsed]);

  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeDragRef.current = {
      startX: event.clientX,
      startWidth: sidebarBodyRef.current?.parentElement?.getBoundingClientRect().width ?? 300,
    };
  };

  const handleResizeMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = resizeDragRef.current;
    if (!drag) {
      return;
    }
    const next = drag.startWidth + (event.clientX - drag.startX);
    const maxWidth = Math.max(220, window.innerWidth - 460);
    setSidebarWidth(Math.min(Math.max(next, 200), maxWidth));
  };

  const handleResizeEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (resizeDragRef.current) {
      resizeDragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

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

  const fileCount = detail?.state === "ok" ? detail.files.length : null;

  return (
    <div className="git-view" data-testid="git-view">
      <nav
        className={`git-sidebar${sidebarCollapsed ? " git-sidebar--collapsed" : ""}`}
        data-testid="git-sidebar"
        style={sidebarWidth !== null && !sidebarCollapsed ? { flexBasis: sidebarWidth } : undefined}
      >
        {sidebarCollapsed ? (
          <button
            className="git-sidebar__rail"
            data-testid="git-sidebar-expand"
            onClick={() => setSidebarCollapsed(false)}
            title={t("git.expandSidebar")}
            type="button"
          >
            ›
          </button>
        ) : (
          <>
        {navLevel === "files" ? (
          <div className="git-sidebar__head">
            <button
              className="git-sidebar__back"
              data-testid="git-sidebar-back"
              onClick={goBackToHistory}
              title={t("git.back")}
              type="button"
            >
              ‹
            </button>
            <span className="git-sidebar__title">{t("git.files")}</span>
            {fileCount !== null ? <span className="git-sidebar__count">{fileCount}</span> : null}
            <span className="git-sidebar__actions">
              <button
                className="git-sidebar__collapse"
                onClick={() => setSidebarCollapsed(true)}
                title={t("git.collapseSidebar")}
                type="button"
              >
                «
              </button>
            </span>
          </div>
        ) : (
          <div className="git-sidebar__head">
            <span className="git-sidebar__title">{t("git.history")}</span>
            {log?.state === "ok" ? (
              <span className="git-sidebar__count">{log.commits.length}</span>
            ) : null}
            <span className="git-sidebar__actions">
              <button
                className="git-sidebar__collapse"
                onClick={() => setSidebarCollapsed(true)}
                title={t("git.collapseSidebar")}
                type="button"
              >
                «
              </button>
            </span>
          </div>
        )}

        <div className="git-sidebar__body" ref={sidebarBodyRef}>
        {navLevel === "history" ? (
        <>
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
              style={{ height: layout.rows.length * GRAPH_ROW_HEIGHT, width: graphWidth }}
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
                      onClick={() => selectCommit(commit.sha)}
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
                            {formatRelativeTime(commit.authorTimestamp)}
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
        </>
        ) : detail != null && detail.state === "ok" ? (
          <ol className="git-files" data-testid="git-file-list">
            {detail.files.map((file) => {
              const active = activeFile?.path === file.path;
              const { dir, base } = splitPath(file.path);
              return (
                <li key={`${file.path}-${file.oldPath ?? ""}`}>
                  <button
                    className={`git-file${active ? " git-file--active" : ""}`}
                    data-testid="git-file-row"
                    onClick={() => {
                      setActiveFile({ path: file.path, oldPath: file.oldPath, binary: file.binary });
                      setFileMode("diff");
                    }}
                    title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
                    type="button"
                  >
                    {file.additions !== null ? (
                      <span className="git-file__count git-file__count--add">+{file.additions}</span>
                    ) : null}
                    {file.deletions !== null ? (
                      <span className="git-file__count git-file__count--del">−{file.deletions}</span>
                    ) : null}
                    <span className="git-file__path">
                      <span className="git-file__dir">{dir}</span>
                      <span className="git-file__base">{base}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="git-view__hint">
            {detailPending ? t("git.loading") : t("git.unavailable")}
          </div>
        )}
        </div>

        <div
          className="git-sidebar__resizer"
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
          role="separator"
          aria-orientation="vertical"
        />
          </>
        )}
      </nav>

      <section className="git-main" data-testid="git-detail">
        {!selectedSha || !detail ? (
          <div className="git-view__hint git-main__placeholder">
            {detailPending ? t("git.loading") : t("git.selectCommit")}
          </div>
        ) : detail.state === "unavailable" ? (
          <div className="git-view__hint git-main__placeholder">{t("git.unavailable")}</div>
        ) : (
          <>
            <header className="git-main__summary">
              <span className="git-main__summary-subject" title={detail.subject}>
                {detail.subject}
              </span>
              <span className="git-main__summary-author">{detail.authorName}</span>
              <span className="git-main__summary-date">
                {formatRelativeTime(detail.authorTimestamp)}
              </span>
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
                        onClick={() => selectCommit(parent)}
                        type="button"
                      >
                        {parent.slice(0, 7)}
                      </button>
                    );
                  })}
                </span>
            </header>

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
                        <button
                          className={`git-toolbar__toggle${fileMode === "blame" ? " git-toolbar__toggle--active" : ""}`}
                          data-testid="git-file-blame"
                          onClick={() => setFileMode(fileMode === "blame" ? "diff" : "blame")}
                          title={t("git.blame")}
                          type="button"
                        >
                          {t("git.blame")}
                        </button>
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
                              onClick={() => selectCommit(line.sha)}
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
              <div className="git-main__welcome">
                {detail.body ? <pre className="git-detail__body">{detail.body}</pre> : null}
                <div className="git-view__hint">{t("git.selectFile")}</div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
