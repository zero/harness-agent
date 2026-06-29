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
});
