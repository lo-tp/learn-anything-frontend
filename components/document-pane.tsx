import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Highlighter } from "shiki";

/**
 * The document pane — a read-only projection of the session's progress
 * markdown (ADR 0001). It renders state, never raw_messages, and is not
 * an editor: learner adjustments flow through chat turns.
 *
 * The markdown is produced by `core/markdown` in later tickets; the
 * highlighter is created once per page load in `app/page.tsx`.
 */
export function DocumentPane({
  markdown,
  highlighter,
}: {
  markdown: string;
  highlighter: Highlighter;
}) {
  const words = markdown.trim().split(/\s+/).length;

  const components: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className ?? "");
      const code = String(children).replace(/\n$/, "");
      // Inline code renders plain; fenced blocks go through shiki.
      if (!match || !code.includes("\n")) {
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      }
      if (!highlighter.getLoadedLanguages().includes(match[1])) {
        return (
          <pre>
            <code className={className}>{code}</code>
          </pre>
        );
      }
      return (
        <div
          className="my-4 overflow-x-auto rounded-lg border border-outline-variant bg-surface-container p-4"
          dangerouslySetInnerHTML={{
            __html: highlighter.codeToHtml(code, {
              lang: match[1],
              theme: "dark-plus",
            }),
          }}
        />
      );
    },
  };

  return (
    <section className="custom-scrollbar relative flex flex-1 flex-col items-center overflow-y-auto bg-background">
      <div className="my-8 w-full max-w-[840px] rounded-xl border border-outline-variant/20 bg-surface-dim px-gutter py-margin-page shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
        <div className="prose prose-invert prose-doc max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {markdown}
          </ReactMarkdown>
        </div>
      </div>

      {/* Status bar */}
      <div className="absolute bottom-0 left-0 z-10 flex h-6 w-full items-center justify-between border-t border-outline-variant bg-surface-container-lowest px-4">
        <div className="flex items-center gap-4 font-label text-[10px] text-on-surface-variant">
          <span>Markdown</span>
          <span>UTF-8</span>
          <span>Words: {words}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          <span className="font-label text-[10px] text-primary">
            AI Ready
          </span>
        </div>
      </div>
    </section>
  );
}
