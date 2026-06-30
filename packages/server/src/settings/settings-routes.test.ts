import { describe, expect, it } from "vitest";

import { createServerApp } from "../app";
import { createTempDataDir } from "../test-utils";

describe("settings routes", () => {
  it("returns defaults with DeepSeek preset and built-in tools", async () => {
    const app = createServerApp({ dataDir: createTempDataDir(), env: {} });
    const response = await app.request("/api/settings");
    const settings = await response.json();

    expect(settings.providerProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "deepseek",
          kind: "openai-compatible",
          baseUrl: "https://api.deepseek.com"
        })
      ])
    );
    expect(settings.enabledToolIds).toEqual(
      expect.arrayContaining(["filesystem.read", "command.execute", "artifact.write"])
    );
    expect(settings.enabledMcpServerIds).toEqual(["community-fixtures"]);
    expect(settings.enabledSkillPaths).toEqual(
      expect.arrayContaining([expect.stringContaining("example-skills/writer")])
    );
  });

  it("updates global settings", async () => {
    const app = createServerApp({ dataDir: createTempDataDir() });
    const current = await (await app.request("/api/settings")).json();
    const updated = {
      ...current,
      enabledToolIds: ["filesystem.read"]
    };

    const response = await app.request("/api/settings", {
      method: "PUT",
      body: JSON.stringify(updated),
      headers: { "content-type": "application/json" }
    });

    expect(await response.json()).toMatchObject({
      enabledToolIds: ["filesystem.read"]
    });
  });

  it("lists configured tools, MCP tools, skills, and validates provider shape", async () => {
    const app = createServerApp({ dataDir: createTempDataDir() });

    const tools = await (await app.request("/api/tools")).json();
    expect(tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "filesystem.read", enabled: true }),
        expect.objectContaining({ id: "artifact.write", enabled: true })
      ])
    );

    const mcpTools = await (await app.request("/api/mcp/tools")).json();
    expect(mcpTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "mcp.web.search" }),
        expect.objectContaining({ id: "mcp.skill.create" })
      ])
    );

    const skills = await (await app.request("/api/skills")).json();
    expect(skills).toMatchObject({
      errors: [],
      skills: expect.arrayContaining([
        expect.objectContaining({
          name: "writer",
          enabled: true
        })
      ])
    });

    const providerTest = await (
      await app.request("/api/providers/test", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" }
      })
    ).json();
    expect(providerTest).toMatchObject({
      ok: true,
      profileId: "deepseek",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      apiKeyConfigured: false,
      apiKeySource: "missing"
    });
  });

  it("validates directly configured provider API keys", async () => {
    const app = createServerApp({ dataDir: createTempDataDir(), env: {} });

    const providerTest = await (
      await app.request("/api/providers/test", {
        method: "POST",
        body: JSON.stringify({
          profile: {
            id: "doubao",
            name: "Doubao",
            kind: "openai-compatible",
            baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
            apiKeyEnv: "direct-test-key-123456",
            model: "doubao-seed"
          }
        }),
        headers: { "content-type": "application/json" }
      })
    ).json();

    expect(providerTest).toMatchObject({
      ok: true,
      profileId: "doubao",
      apiKeyConfigured: true,
      apiKeySource: "direct"
    });
    expect(providerTest).not.toHaveProperty("apiKeyEnv");
  });
});
