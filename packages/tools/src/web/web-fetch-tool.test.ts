import { createServer } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { fetchWebPage } from "./web-fetch-tool";

let closeServer: (() => Promise<void>) | undefined;

afterEach(async () => {
  await closeServer?.();
  closeServer = undefined;
});

describe("web fetch tool", () => {
  it("fetches text, title, links, and metadata", async () => {
    const server = createServer((_request, response) => {
      response.setHeader("content-type", "text/html");
      response.end(
        "<!doctype html><title>Hello</title><a href=\"/next\">Next</a><p>Body text</p>"
      );
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    closeServer = () => new Promise((resolve) => server.close(() => resolve()));
    const address = server.address();
    if (typeof address !== "object" || !address) {
      throw new Error("Expected server address");
    }

    const result = await fetchWebPage({
      url: `http://127.0.0.1:${address.port}`,
      timeoutMs: 1000,
      maxBytes: 4096
    });

    expect(result.title).toBe("Hello");
    expect(result.text).toContain("Body text");
    expect(result.links).toEqual(["/next"]);
    expect(result.contentType).toContain("text/html");
  });
});
