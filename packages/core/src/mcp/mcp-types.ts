import type { ToolDefinition } from "../tools/tool-types";

export type McpServerConfig =
  | {
      id: string;
      name: string;
      transport: "stdio";
      command: string;
      args: string[];
      env?: Record<string, string>;
    }
  | {
      id: string;
      name: string;
      transport: "http";
      url: string;
      headers?: Record<string, string>;
    };

export interface McpAdapter {
  listTools(server: McpServerConfig): Promise<ToolDefinition[]>;
  callTool(server: McpServerConfig, toolId: string, input: unknown): Promise<unknown>;
}
