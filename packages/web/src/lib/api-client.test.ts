import { describe, expect, it } from "vitest";

import { createApiClient } from "./api-client";

describe("api client", () => {
  it("fetches projects and settings from the local server", async () => {
    const calls: string[] = [];
    const client = createApiClient({
      baseUrl: "http://127.0.0.1:8787",
      fetchImpl: async (input) => {
        calls.push(String(input));
        return new Response(JSON.stringify(input.toString().endsWith("/settings") ? { ok: true } : []));
      }
    });

    await expect(client.listProjects()).resolves.toEqual([]);
    await expect(client.getSettings()).resolves.toEqual({ ok: true });
    expect(calls).toEqual([
      "http://127.0.0.1:8787/api/projects",
      "http://127.0.0.1:8787/api/settings"
    ]);
  });

  it("sends session messages and reads generated artifact previews", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = createApiClient({
      baseUrl: "http://127.0.0.1:8787",
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), init });
        if (String(input).endsWith("/messages")) {
          return new Response(JSON.stringify({ ok: true, events: 8 }));
        }
        if (String(input).includes("/preview")) {
          return new Response(JSON.stringify({ kind: "markdown", content: "# Report" }));
        }
        return new Response(JSON.stringify([]));
      }
    });

    await expect(client.sendMessage("session-1", "draft report")).resolves.toEqual({
      ok: true,
      events: 8
    });
    await expect(client.listArtifacts({ sessionId: "session-1" })).resolves.toEqual([]);
    await expect(client.getArtifactPreview("artifact-1")).resolves.toEqual({
      kind: "markdown",
      content: "# Report"
    });

    expect(calls.map((call) => call.url)).toEqual([
      "http://127.0.0.1:8787/api/sessions/session-1/messages",
      "http://127.0.0.1:8787/api/artifacts?sessionId=session-1",
      "http://127.0.0.1:8787/api/artifacts/artifact-1/preview"
    ]);
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ content: "draft report" }));
  });
});
