import { load } from "cheerio";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: "html" | "searxng";
}

export function parseSearchHtml(html: string): WebSearchResult[] {
  const $ = load(html);
  const results: WebSearchResult[] = [];

  $(".result-link").each((index, element) => {
    const link = $(element);
    const snippet = $(".result-snippet").eq(index).text().trim();
    const title = link.text().trim();
    const url = link.attr("href");

    if (title && url) {
      results.push({
        title,
        url,
        snippet,
        source: "html"
      });
    }
  });

  return results;
}

export async function searchWeb(input: {
  query: string;
  endpoint?: string;
  timeoutMs: number;
  maxBytes: number;
}): Promise<WebSearchResult[]> {
  const endpoint =
    input.endpoint ??
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(input.query)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    const contentType = response.headers.get("content-type") ?? "";
    const body = (await response.text()).slice(0, input.maxBytes);

    if (contentType.includes("application/json")) {
      const json = JSON.parse(body) as {
        results?: Array<{ title: string; url: string; content?: string }>;
      };
      return (json.results ?? []).map((result) => ({
        title: result.title,
        url: result.url,
        snippet: result.content ?? "",
        source: "searxng"
      }));
    }

    return parseSearchHtml(body);
  } finally {
    clearTimeout(timeout);
  }
}
