import { load } from "cheerio";

export interface FetchWebPageInput {
  url: string;
  timeoutMs: number;
  maxBytes: number;
}

export interface FetchWebPageResult {
  url: string;
  title: string;
  text: string;
  links: string[];
  contentType: string;
}

export async function fetchWebPage(input: FetchWebPageInput): Promise<FetchWebPageResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await fetch(input.url, {
      signal: controller.signal,
      headers: {
        "user-agent": "harness-agent/0.0.0"
      }
    });
    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const text = (await response.text()).slice(0, input.maxBytes);
    const $ = load(text);

    return {
      url: response.url,
      title: $("title").first().text().trim(),
      text: $("body").text().replace(/\s+/g, " ").trim(),
      links: $("a")
        .map((_index, element) => $(element).attr("href"))
        .get()
        .filter((href): href is string => Boolean(href)),
      contentType
    };
  } finally {
    clearTimeout(timeout);
  }
}
