import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { cn } from "@/lib/utils";

export function MarkdownRenderer({
  content,
  className
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={cn("markdown-body", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeSanitize, rehypeKatex]}
        components={{
          code({ className: codeClassName, children, ...props }) {
            const language = /language-(\w+)/.exec(codeClassName ?? "")?.[1];
            if (language === "mermaid") {
              return (
                <pre data-diagram="mermaid" className="overflow-auto rounded-md bg-muted p-3 text-sm">
                  {String(children).trim()}
                </pre>
              );
            }
            return (
              <code className={cn("rounded bg-muted px-1 py-0.5 text-sm", codeClassName)} {...props}>
                {children}
              </code>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
