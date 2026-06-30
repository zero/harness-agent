import {
  DEEPSEEK_PRESET,
  type GlobalSettings
} from "@harness-agent/core";
import { join } from "node:path";

function exampleWriterSkillPath(): string {
  return join(process.cwd(), "../example-skills/writer");
}

export function createDefaultSettings(): GlobalSettings {
  const writerSkillPath = exampleWriterSkillPath();

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
    skillPaths: [writerSkillPath],
    enabledSkillPaths: [writerSkillPath],
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
