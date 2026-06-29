import { describe, expect, it } from "vitest";

import { McpRegistry } from "@harness-agent/core";

import {
  createCommunityMcpFixtureServer,
  createFixtureMcpAdapter,
  mcpFixturesPackageName
} from "./index";

describe("mcp fixtures package", () => {
  it("exports its package name", () => {
    expect(mcpFixturesPackageName).toBe("@harness-agent/mcp-fixtures");
  });

  it("speaks a minimal MCP tool-list and tool-call protocol", async () => {
    const server = createCommunityMcpFixtureServer();

    const initialize = await server.handle({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {}
    });
    const tools = await server.handle({ jsonrpc: "2.0", id: 2, method: "tools/list" });

    expect(initialize).toMatchObject({
      result: {
        serverInfo: { name: "harness-agent-community-fixtures" },
        capabilities: { tools: {} }
      }
    });
    expect(tools).toMatchObject({
      result: {
        tools: expect.arrayContaining([
          expect.objectContaining({ id: "mcp.filesystem.read_file" }),
          expect.objectContaining({ id: "mcp.web.fetch" }),
          expect.objectContaining({ id: "mcp.web.search" }),
          expect.objectContaining({ id: "mcp.artifact.write" }),
          expect.objectContaining({ id: "mcp.skill.create" })
        ])
      }
    });
  });

  it("adapts fixture tools into the core MCP registry", async () => {
    const registry = new McpRegistry(createFixtureMcpAdapter(), [
      {
        id: "community-fixtures",
        name: "Community Fixtures",
        transport: "stdio",
        command: "node",
        args: ["fixture.js"]
      }
    ]);

    const tools = await registry.listTools();
    const result = (await registry.callTool("community-fixtures", "mcp.web.search", {
      query: "harness agent"
    })) as { results: { url: string }[] };

    expect(tools.map((tool) => tool.id)).toEqual(
      expect.arrayContaining(["mcp.filesystem.write_file", "mcp.web.search", "mcp.artifact.write"])
    );
    expect(result.results[0]?.url).toBe("https://example.com/harness-agent");
  });
});
