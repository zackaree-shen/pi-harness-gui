import { memo, useEffect, useRef, useState } from "react";
import { CopyIcon } from "./icons";
import { useT } from "./i18n";

/**
 * Live rendering of assistant-emitted ```html / ```svg fenced blocks.
 *
 * Security model: the artifact runs in a sandboxed iframe (sandbox="allow-scripts",
 * no allow-same-origin) with an opaque origin. It cannot reach the parent window
 * (Chromium blocks cross-origin parent access — verified), localStorage, or the
 * contextBridge API; the only channel back is postMessage, validated by
 * comparing event.source against the iframe's contentWindow.
 */

/** Height clamps aligned with estimateTimelineItemHeight heuristics in
 *  conversation-timeline.tsx (image attachment rows estimate 120px; text rows
 *  use a 20px line height capped at 240px). Initial 240 = text cap; max 480 =
 *  24 visible lines at the same 20px line height to keep virtualizer offsets sane. */
export const ARTIFACT_MIN_HEIGHT = 120;
export const ARTIFACT_MAX_HEIGHT = 480;
export const ARTIFACT_INITIAL_HEIGHT = 240;

const ARTIFACT_HEIGHT_MESSAGE_TYPE = "pi-artifact-height";
export const ARTIFACT_LANGS = new Set(["html", "svg"]);

function clampArtifactHeight(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return ARTIFACT_INITIAL_HEIGHT;
  return Math.min(ARTIFACT_MAX_HEIGHT, Math.max(ARTIFACT_MIN_HEIGHT, Math.round(raw)));
}

/**
 * CommonMark §4.5 fence tracking, single state machine (NOT a "stack"):
 * fenced blocks cannot nest; a line is a closing fence only when it starts
 * with ≤3 spaces, repeats the SAME fence character, is at least as long as
 * the opening fence, and contains nothing but that character plus trailing
 * spaces. A backtick fence whose info string contains a backtick is not an
 * opening fence. This mirrors how micromark (react-markdown) parses the same
 * text, so renderer and scanner never disagree.
 *
 * Returns a map from opening-fence line number (1-based) to whether an
 * explicit closing fence was seen. Non-artifact fences are still consumed
 * by the same rules so their content cannot be misread as new fences.
 */
export function scanFencedArtifactBlocks(markdown: string): Map<number, boolean> {
  const artifacts = new Map<number, boolean>();
  const lines = markdown.split("\n");
  const fencePattern = /^ {0,3}(`{3,}|~{3,})(.*)$/;
  let index = 0;
  while (index < lines.length) {
    const match = fencePattern.exec(lines[index] ?? "");
    if (!match) {
      index += 1;
      continue;
    }
    const fenceChar = match[1]?.charAt(0) ?? "";
    const fenceLength = match[1]?.length ?? 0;
    const info = (match[2] ?? "").trim();
    // Backtick fences reject a backtick inside the info string.
    if (fenceChar === "`" && info.includes("`")) {
      index += 1;
      continue;
    }
    const infoLang = info.split(/\s+/)[0]?.toLowerCase() ?? "";
    let closed = false;
    let cursor = index + 1;
    while (cursor < lines.length) {
      const candidate = lines[cursor] ?? "";
      const closeMatch = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(candidate);
      if (closeMatch && closeMatch[1]?.charAt(0) === fenceChar && (closeMatch[1]?.length ?? 0) >= fenceLength) {
        closed = true;
        break;
      }
      cursor += 1;
    }
    if (ARTIFACT_LANGS.has(infoLang)) {
      artifacts.set(index + 1, closed);
    }
    index = closed ? cursor + 1 : lines.length;
  }
  return artifacts;
}

/** Injected into the srcdoc: reports content height after layout (rAF, because a
 *  synchronous first report measures 0 before layout) and on later resizes. */
const HEIGHT_REPORTER_SCRIPT = `<script>(function(){
var send=function(){requestAnimationFrame(function(){
var b=document.body,d=document.documentElement;
var h=Math.max(b?b.scrollHeight:0,d?d.scrollHeight:0);
parent.postMessage({type:"${ARTIFACT_HEIGHT_MESSAGE_TYPE}",h:h},"*");
});};
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",send);}else{send();}
try{if(window.ResizeObserver){new ResizeObserver(send).observe(document.documentElement);}}catch(e){}
})();</scr` + `ipt>`;

function buildArtifactDocument(code: string, lang: string): string {
  if (lang === "svg") {
    return (
      `<!doctype html><html><head><meta charset="utf-8"><style>` +
      `body{margin:0;display:flex;justify-content:center;padding:8px;min-height:100%}` +
      `svg{max-width:100%;height:auto}` +
      `</style></head><body>${code}${HEIGHT_REPORTER_SCRIPT}</body></html>`
    );
  }
  return `${code}${HEIGHT_REPORTER_SCRIPT}`;
}

interface HtmlArtifactProps {
  readonly code: string;
  readonly lang: string;
  /** True once the closing fence has been seen, or the message is no longer
   *  streaming (CommonMark treats an unterminated fence as running to EOF). */
  readonly complete: boolean;
  readonly streaming: boolean;
}

function HtmlArtifactImpl({ code, lang, complete, streaming }: HtmlArtifactProps) {
  const t = useT();
  const [mode, setMode] = useState<"preview" | "code">(complete ? "preview" : "code");
  const [height, setHeight] = useState(ARTIFACT_INITIAL_HEIGHT);
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const userToggledRef = useRef(false);

  // Flip to the preview automatically once the block completes, unless the
  // user has already chosen a view manually.
  useEffect(() => {
    if (complete && mode === "code" && !userToggledRef.current) setMode("preview");
  }, [complete, mode]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frame = iframeRef.current;
      if (!frame || event.source == null || event.source !== frame.contentWindow) return;
      const data = event.data as { type?: unknown; h?: unknown } | null;
      if (data && typeof data === "object" && data.type === ARTIFACT_HEIGHT_MESSAGE_TYPE && typeof data.h === "number") {
        setHeight(clampArtifactHeight(data.h));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard access can be denied; ignore silently.
    }
  };

  const selectMode = (next: "preview" | "code") => {
    userToggledRef.current = true;
    setMode(next);
  };

  const normalizedCode = code.replace(/\n$/, "");

  return (
    <div className="html-artifact" data-testid="html-artifact" data-artifact-lang={lang}>
      <div className="html-artifact__toolbar">
        <span className="html-artifact__lang">{lang}</span>
        <div className="html-artifact__toolbar-actions">
          <button
            aria-pressed={mode === "preview"}
            className={`html-artifact__tab ${mode === "preview" ? "html-artifact__tab--active" : ""}`}
            data-testid="html-artifact-preview"
            onClick={() => selectMode("preview")}
            type="button"
          >
            {t("timeline.artifactPreview")}
          </button>
          <button
            aria-pressed={mode === "code"}
            className={`html-artifact__tab ${mode === "code" ? "html-artifact__tab--active" : ""}`}
            data-testid="html-artifact-code"
            onClick={() => selectMode("code")}
            type="button"
          >
            {t("timeline.artifactCode")}
          </button>
          <button
            className="html-artifact__copy"
            data-testid="html-artifact-copy"
            onClick={copyCode}
            title={t("timeline.artifactCopy")}
            type="button"
          >
            <CopyIcon />
            {copied ? <span className="html-artifact__copied">{t("timeline.artifactCopied")}</span> : null}
          </button>
        </div>
        {streaming && !complete ? (
          <span className="html-artifact__streaming" data-testid="html-artifact-streaming">
            {t("timeline.artifactRendering")}
          </span>
        ) : null}
      </div>
      {mode === "preview" && complete ? (
        <iframe
          className="html-artifact__frame"
          ref={iframeRef}
          sandbox="allow-scripts"
          srcDoc={buildArtifactDocument(code, lang)}
          style={{ height: `${height}px` }}
          title="HTML artifact preview"
        />
      ) : (
        <pre className="html-artifact__code">
          <code className={`language-${lang}`}>{normalizedCode}</code>
        </pre>
      )}
    </div>
  );
}

export const HtmlArtifact = memo(HtmlArtifactImpl);
