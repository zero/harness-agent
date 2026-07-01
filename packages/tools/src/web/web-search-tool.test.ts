import { describe, expect, it } from "vitest";

import { parseSearchHtml } from "./web-search-tool";

describe("web search tool", () => {
  it("parses free HTML search results into structured results", () => {
    const results = parseSearchHtml(`
      <a class="result-link" href="https://example.com/a">Alpha</a>
      <div class="result-snippet">First result</div>
      <a class="result-link" href="https://example.com/b">Beta</a>
      <div class="result-snippet">Second result</div>
    `);

    expect(results).toEqual([
      {
        title: "Alpha",
        url: "https://example.com/a",
        snippet: "First result",
        source: "html"
      },
      {
        title: "Beta",
        url: "https://example.com/b",
        snippet: "Second result",
        source: "html"
      }
    ]);
  });
});
