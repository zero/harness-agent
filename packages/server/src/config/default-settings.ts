import {
  DEEPSEEK_PRESET,
  type GlobalSettings
} from "@harness-agent/core";

export function createDefaultSettings(): GlobalSettings {
  return {
    providerProfiles: [DEEPSEEK_PRESET],
    enabledToolIds: [
      "filesystem.read",
      "filesystem.write",
      "filesystem.list",
      "filesystem.search",
      "command.execute",
      "web.fetch",
      "web.search",
      "artifact.write",
      "skill.create"
    ],
    mcpServers: [],
    enabledMcpServerIds: [],
    skillPaths: [],
    enabledSkillPaths: [],
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
}
