import type { McpServerConfig } from "../mcp/mcp-types";
import type { ProviderProfile } from "../providers/provider-types";

export interface CommandPolicy {
  timeoutMs: number;
  maxOutputBytes: number;
  allowedEnvKeys: string[];
}

export interface WebPolicy {
  timeoutMs: number;
  maxResponseBytes: number;
  searchEndpoint?: string;
}

export interface GlobalSettings {
  providerProfiles: ProviderProfile[];
  enabledToolIds: string[];
  mcpServers: McpServerConfig[];
  enabledMcpServerIds: string[];
  skillPaths: string[];
  enabledSkillPaths: string[];
  commandPolicy: CommandPolicy;
  webPolicy: WebPolicy;
}
