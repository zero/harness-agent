import { describe, expect, it } from "vitest";

import { createServerApp } from "../app";
import { createTempDataDir } from "../test-utils";

describe("settings routes", () => {
  it("returns defaults with DeepSeek preset and built-in tools", async () => {
    const app = createServerApp({ dataDir: createTempDataDir() });
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
    expect(settings.enabledMcpServerIds).toEqual([]);
    expect(settings.enabledSkillPaths).toEqual([]);
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
});
