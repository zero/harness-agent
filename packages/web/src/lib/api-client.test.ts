import { describe, expect, it } from "vitest";

import { createApiClient } from "./api-client";

describe("api client", () => {
  it("fetches projects and settings from the local server", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const client = createApiClient({
      baseUrl: "http://127.0.0.1:18787",
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), init });
        if (init?.method === "DELETE") {
          return new Response(null, { status: 204 });
        }
        if (input.toString().endsWith("/workspaces/pick")) {
          return new Response(JSON.stringify({ workspacePath: "/Users/example/Desktop" }));
        }
        return new Response(JSON.stringify(input.toString().endsWith("/settings") ? { ok: true } : []));
      }
    });

    await expect(client.listProjects()).resolves.toEqual([]);
    await expect(client.getSettings()).resolves.toEqual({ ok: true });
    await expect(client.pickWorkspace()).resolves.toEqual({ workspacePath: "/Users/example/Desktop" });
    await expect(client.deleteProject("project-1")).resolves.toEqual(undefined);
    expect(calls.map((call) => call.url)).toEqual([
      "http://127.0.0.1:18787/api/projects",
      "http://127.0.0.1:18787/api/settings",
      "http://127.0.0.1:18787/api/workspaces/pick",
      "http://127.0.0.1:18787/api/projects/project-1"
    ]);
    expect(calls[2]?.init?.method).toBe("POST");
    expect(calls[3]?.init?.method).toBe("DELETE");
  });

  it("saves settings and loads integration diagnostics", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = createApiClient({
      baseUrl: "http://127.0.0.1:18787",
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), init });
        if (String(input).endsWith("/settings")) {
          return new Response(JSON.stringify({ providerProfiles: [], enabledToolIds: [] }));
        }
        if (String(input).endsWith("/mcp/tools")) {
          return new Response(JSON.stringify([{ id: "mcp.web.search" }]));
        }
        if (String(input).endsWith("/tools")) {
          return new Response(JSON.stringify([{ id: "filesystem.read" }]));
        }
        if (String(input).endsWith("/skills")) {
          return new Response(JSON.stringify({ skills: [{ name: "writer" }], errors: [] }));
        }
        if (String(input).endsWith("/providers/test")) {
          return new Response(JSON.stringify({ ok: true, message: "valid" }));
        }
        if (String(input).endsWith("/mcp/test")) {
          return new Response(JSON.stringify({ ok: true, toolCount: 6 }));
        }
        return new Response(JSON.stringify([]));
      }
    });

    await expect(
      client.saveSettings({
        providerProfiles: [],
        enabledToolIds: [],
        mcpServers: [],
        enabledMcpServerIds: [],
        skillPaths: [],
        enabledSkillPaths: [],
        commandPolicy: { timeoutMs: 30_000, maxOutputBytes: 64_000, allowedEnvKeys: [] },
        webPolicy: { timeoutMs: 15_000, maxResponseBytes: 1_000_000 }
      })
    ).resolves.toMatchObject({ providerProfiles: [] });
    await expect(client.listTools()).resolves.toEqual([{ id: "filesystem.read" }]);
    await expect(client.listMcpTools()).resolves.toEqual([{ id: "mcp.web.search" }]);
    await expect(client.listSkills()).resolves.toEqual({ skills: [{ name: "writer" }], errors: [] });
    await expect(
      client.testProvider({
        id: "deepseek",
        name: "DeepSeek",
        kind: "openai-compatible",
        baseUrl: "https://api.deepseek.com",
        apiKeyEnv: "DEEPSEEK_API_KEY",
        model: "deepseek-chat"
      })
    ).resolves.toEqual({ ok: true, message: "valid" });
    await expect(client.testMcp("community-fixtures")).resolves.toEqual({ ok: true, toolCount: 6 });

    expect(calls.map((call) => call.url)).toEqual([
      "http://127.0.0.1:18787/api/settings",
      "http://127.0.0.1:18787/api/tools",
      "http://127.0.0.1:18787/api/mcp/tools",
      "http://127.0.0.1:18787/api/skills",
      "http://127.0.0.1:18787/api/providers/test",
      "http://127.0.0.1:18787/api/mcp/test"
    ]);
  });

  it("sends session messages and reads generated artifact previews", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = createApiClient({
      baseUrl: "http://127.0.0.1:18787",
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), init });
        if (String(input).endsWith("/messages")) {
          return new Response(JSON.stringify({ ok: true, events: 8 }));
        }
        if (String(input).endsWith("/events.json")) {
          return new Response(JSON.stringify([{ type: "tool.call", toolName: "filesystem.list" }]));
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
    await expect(client.listSessionEvents("session-1")).resolves.toEqual([
      { type: "tool.call", toolName: "filesystem.list" }
    ]);
    await expect(client.listArtifacts({ sessionId: "session-1" })).resolves.toEqual([]);
    await expect(client.getArtifactPreview("artifact-1")).resolves.toEqual({
      kind: "markdown",
      content: "# Report"
    });

    expect(calls.map((call) => call.url)).toEqual([
      "http://127.0.0.1:18787/api/sessions/session-1/messages",
      "http://127.0.0.1:18787/api/sessions/session-1/events.json",
      "http://127.0.0.1:18787/api/artifacts?sessionId=session-1",
      "http://127.0.0.1:18787/api/artifacts/artifact-1/preview"
    ]);
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ content: "draft report" }));
  });
});
