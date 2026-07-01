import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarkdownRenderer } from "./markdown-renderer";

describe("MarkdownRenderer", () => {
  it("renders GFM tables, task lists, code, Mermaid blocks, math, and sanitized HTML", () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer
        content={[
          "# Report",
          "",
          "- [x] Done",
          "",
          "| Name | Value |",
          "| --- | --- |",
          "| Alpha | 1 |",
          "",
          "```ts",
          "const value = 1;",
          "```",
          "",
          "```mermaid",
          "graph TD; A-->B;",
          "```",
          "",
          "$x^2$",
          "",
          "<script>alert('x')</script>"
        ].join("\n")}
      />
    );

    expect(html).toContain("<h1");
    expect(html).toContain("<table");
    expect(html).toContain("const value = 1;");
    expect(html).toContain("data-diagram=\"mermaid\"");
    expect(html).toContain("katex");
    expect(html).not.toContain("<script>");
  });
});
