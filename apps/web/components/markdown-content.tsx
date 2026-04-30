import { cn } from "@/lib/utils";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

const components: Components = {
  h1: ({ className, ...props }) => (
    <h1
      className={cn(
        "mt-0 mb-4 border-plexus-border border-b pb-3 text-2xl font-semibold tracking-normal text-plexus-text",
        className,
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn("mt-7 mb-3 text-xl font-semibold tracking-normal text-plexus-text", className)}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cn(
        "mt-6 mb-2 text-base font-semibold tracking-normal text-plexus-text",
        className,
      )}
      {...props}
    />
  ),
  h4: ({ className, ...props }) => (
    <h4
      className={cn("mt-5 mb-2 text-sm font-semibold tracking-normal text-plexus-text", className)}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p className={cn("my-3 leading-7 text-plexus-text-2", className)} {...props} />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn("font-medium text-plexus-accent underline-offset-4 hover:underline", className)}
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn("my-3 list-disc space-y-1.5 pl-6 text-plexus-text-2", className)}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn("my-3 list-decimal space-y-1.5 pl-6 text-plexus-text-2", className)}
      {...props}
    />
  ),
  li: ({ className, ...props }) => <li className={cn("pl-1 leading-7", className)} {...props} />,
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        "my-4 border-plexus-accent/40 border-l-2 bg-plexus-accent-faint/40 px-4 py-2 text-plexus-text-2",
        className,
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn("my-6 border-plexus-border", className)} {...props} />
  ),
  code: ({ className, ...props }) => (
    <code
      className={cn(
        "rounded-sm bg-plexus-surface-2 px-1.5 py-0.5 font-mono text-[0.88em] text-plexus-text",
        className,
      )}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        "my-4 overflow-x-auto rounded-md border border-plexus-border bg-plexus-bg p-4 text-xs leading-6 text-plexus-text [&_code]:bg-transparent [&_code]:p-0",
        className,
      )}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <div className="my-4 overflow-x-auto rounded-md border border-plexus-border">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn(
        "border-plexus-border border-b bg-plexus-surface-2 px-3 py-2 text-left font-semibold text-plexus-text",
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn("border-plexus-border border-t px-3 py-2 text-plexus-text-2", className)}
      {...props}
    />
  ),
};

export function MarkdownContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  if (!content.trim()) {
    return <div className={cn("text-sm text-plexus-text-3", className)}>Empty markdown file.</div>;
  }

  return (
    <div className={cn("min-w-0 text-sm", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
