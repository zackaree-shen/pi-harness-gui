import { isValidElement, memo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { HtmlArtifact, scanFencedArtifactBlocks, ARTIFACT_LANGS } from "./html-artifact";

const REMARK_PLUGINS = [remarkGfm];

function normalizeCodeText(children: ReactNode): string {
  return String(children ?? "").replace(/\n$/, "");
}

interface FencedArtifactInfo {
  readonly lang: string;
  readonly code: string;
}

/** Extract the fenced-block language and raw code from the <pre><code> children
 *  react-markdown hands to the `pre` component override. */
function readFencedArtifact(children: ReactNode): FencedArtifactInfo | null {
  if (!isValidElement(children)) return null;
  const childProps = children.props as { className?: unknown; children?: unknown };
  const className = typeof childProps.className === "string" ? childProps.className : "";
  const langMatch = /^language-([\w-]+)/.exec(className);
  const lang = langMatch?.[1]?.toLowerCase() ?? "";
  if (!ARTIFACT_LANGS.has(lang)) return null;
  return { lang, code: String(childProps.children ?? "") };
}

interface MessageMarkdownProps {
  readonly text: string;
  /** Render ```html / ```svg fenced blocks as live sandboxed previews. */
  readonly enableArtifacts?: boolean;
  /** True while the owning message is still being streamed. */
  readonly streaming?: boolean;
}

function MessageMarkdownImpl({ text, enableArtifacts = false, streaming = false }: MessageMarkdownProps) {
  // Artifact fence tracking is recomputed only when the text actually changes;
  // memoizing the component keeps non-streaming timeline rows from re-parsing.
  const artifactBlocks = enableArtifacts ? scanFencedArtifactBlocks(text) : undefined;

  const components: Components = {
    code: ({ className, children }: { className?: string; children?: ReactNode }) => (
      <code className={className}>{normalizeCodeText(children)}</code>
    ),
    a: ({ href, children }: { href?: string; children?: ReactNode }) => (
      <a href={href} rel="noreferrer" target="_blank">
        {children}
      </a>
    ),
  };

  if (artifactBlocks && artifactBlocks.size > 0) {
    components.pre = ({ children, node, ...rest }) => {
      const info = readFencedArtifact(children);
      const startLine = node?.position?.start.line;
      if (info && startLine !== undefined) {
        const closed = artifactBlocks.get(startLine);
        // A fence the scanner knows about is rendered live; the closing-fence
        // flag falls back to "complete" once the message stops streaming
        // (CommonMark treats an unterminated fence as running to EOF).
        if (closed !== undefined) {
          return (
            <HtmlArtifact code={info.code} complete={closed || !streaming} lang={info.lang} streaming={streaming} />
          );
        }
      }
      return <pre {...rest}>{children}</pre>;
    };
  }

  return (
    <div className="message__content">
      <ReactMarkdown components={components} remarkPlugins={REMARK_PLUGINS}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

export const MessageMarkdown = memo(MessageMarkdownImpl);
