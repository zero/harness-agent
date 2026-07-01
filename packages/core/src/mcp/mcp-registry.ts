import type { ToolDefinition } from "../tools/tool-types";
import type { McpAdapter, McpServerConfig } from "./mcp-types";

export class McpRegistry {
  private readonly servers = new Map<string, McpServerConfig>();

  constructor(
    private readonly adapter: McpAdapter,
    servers: McpServerConfig[] = []
  ) {
    for (const server of servers) {
      this.servers.set(server.id, server);
    }
  }

  async listTools(): Promise<ToolDefinition[]> {
    const nestedTools = await Promise.all(
      [...this.servers.values()].map((server) => this.adapter.listTools(server))
    );

    return nestedTools.flat();
  }

  async callTool(serverId: string, toolId: string, input: unknown): Promise<unknown> {
    const server = this.servers.get(serverId);

    if (!server) {
      throw new Error(`MCP server not found: ${serverId}`);
    }

    return this.adapter.callTool(server, toolId, input);
  }
}
