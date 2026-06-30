import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { GlobalSettingsDto, SkillLoadResultDto, ToolDefinitionDto } from "@/lib/api-client";
import { SettingsPage } from "./settings-page";

describe("SettingsPage", () => {
  it("renders tab triggers and only the active providers panel by default", () => {
    const settings: GlobalSettingsDto = {
      providerProfiles: [
        {
          id: "deepseek",
          name: "DeepSeek",
          kind: "openai-compatible",
          baseUrl: "https://api.deepseek.com",
          apiKeyEnv: "DEEPSEEK_API_KEY",
          model: "deepseek-chat"
        }
      ],
      enabledToolIds: ["filesystem.read"],
      mcpServers: [
        {
          id: "community-fixtures",
          name: "Community Fixtures",
          transport: "stdio",
          command: "fixture",
          args: []
        }
      ],
      enabledMcpServerIds: ["community-fixtures"],
      skillPaths: ["/tmp/writer"],
      enabledSkillPaths: ["/tmp/writer"],
      commandPolicy: {
        timeoutMs: 30_000,
        maxOutputBytes: 64_000,
        allowedEnvKeys: ["PATH", "HOME"]
      },
      webPolicy: {
        timeoutMs: 15_000,
        maxResponseBytes: 1_000_000
      }
    };
    const tools: ToolDefinitionDto[] = [
      {
        id: "filesystem.read",
        name: "Read file",
        description: "Read files inside the selected project."
      }
    ];
    const skills: SkillLoadResultDto = {
      skills: [
        {
          name: "writer",
          description: "Draft local reports.",
          path: "/tmp/writer",
          triggers: ["report"],
          enabled: true
        }
      ],
      errors: []
    };

    const html = renderToStaticMarkup(
      <SettingsPage
        settings={settings}
        tools={tools}
        mcpTools={[
          {
            id: "mcp.web.search",
            name: "Search web",
            description: "Fixture web search."
          }
        ]}
        skills={skills}
      />
    );

    expect(html).toContain("Providers");
    expect(html).toContain("Tools");
    expect(html).toContain("Skills");
    expect(html).toContain("Safety");
    expect(html).toContain("DeepSeek");
    expect(html).toContain("Add provider");
    expect(html).not.toContain("filesystem.read");
    expect(html).not.toContain("Community Fixtures");
    expect(html).not.toContain("mcp.web.search");
    expect(html).not.toContain("writer");
    expect(html).not.toContain("Command timeout");
  });
});
