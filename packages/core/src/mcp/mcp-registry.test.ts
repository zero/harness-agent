import { describe, expect, it } from "vitest";

import { McpRegistry } from "./mcp-registry";
import type { McpAdapter, McpServerConfig } from "./mcp-types";

const adapter: McpAdapter = {
  async listTools(_server: McpServerConfig) {
    return [
      {
        id: "fixture.echo",
        name: "Echo",
        description: "Echo input",
        inputSchema: { type: "object", properties: {} }
      }
    ];
  },
  async callTool(_server, toolId, input) {
    return { toolId, input };
  }
};

describe("McpRegistry", () => {
  it("lists and calls MCP tools through an adapter", async () => {
    const registry = new McpRegistry(adapter, [
      {
        id: "fixture",
        name: "Fixture",
        transport: "stdio",
        command: "node",
        args: ["fixture.js"]
      }
    ]);

    await expect(registry.listTools()).resolves.toHaveLength(1);
    await expect(registry.callTool("fixture", "fixture.echo", { value: 1 })).resolves.toEqual({
      toolId: "fixture.echo",
      input: { value: 1 }
    });
  });
});
