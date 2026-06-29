import { ToolRegistry } from "@harness-agent/core";

import { executeProjectCommand } from "./code-execution/command-tool";
import {
  listProjectDirectory,
  readProjectFile,
  searchProjectFiles,
  writeProjectFile
} from "./filesystem/filesystem-tool";
import { createSkillSkeleton } from "./skill-creator/skill-creator-tool";
import { writeArtifact } from "./artifacts/artifact-writers";
import { fetchWebPage } from "./web/web-fetch-tool";
import { searchWeb } from "./web/web-search-tool";

const objectSchema = { type: "object" as const, properties: {} };

export function registerBuiltInTools(registry: ToolRegistry): void {
  registry.register(
    {
      id: "filesystem.read",
      name: "Read file",
      description: "Read a text file inside the current project workspace.",
      inputSchema: objectSchema
    },
    async ({ project, input }) =>
      readProjectFile(project, (input as { path: string }).path)
  );
  registry.register(
    {
      id: "filesystem.write",
      name: "Write file",
      description: "Write a text file inside the current project workspace.",
      inputSchema: objectSchema
    },
    async ({ project, input }) => {
      const payload = input as { path: string; content: string };
      writeProjectFile(project, payload.path, payload.content);
      return { ok: true };
    }
  );
  registry.register(
    {
      id: "filesystem.list",
      name: "List directory",
      description: "List a directory inside the current project workspace.",
      inputSchema: objectSchema
    },
    async ({ project, input }) =>
      listProjectDirectory(project, (input as { path: string }).path)
  );
  registry.register(
    {
      id: "filesystem.search",
      name: "Search files",
      description: "Search text files inside the current project workspace.",
      inputSchema: objectSchema
    },
    async ({ project, input }) =>
      searchProjectFiles(project, (input as { query: string }).query)
  );
  registry.register(
    {
      id: "command.execute",
      name: "Execute command",
      description: "Execute a shell command inside the current project workspace.",
      inputSchema: objectSchema
    },
    async ({ project, input }) =>
      executeProjectCommand(project, {
        timeoutMs: 30_000,
        maxOutputBytes: 64_000,
        ...(input as { command: string; cwd?: string; timeoutMs?: number; maxOutputBytes?: number })
      })
  );
  registry.register(
    {
      id: "web.fetch",
      name: "Fetch URL",
      description: "Fetch and summarize a web page.",
      inputSchema: objectSchema
    },
    async ({ input }) =>
      fetchWebPage({
        timeoutMs: 15_000,
        maxBytes: 1_000_000,
        ...(input as { url: string; timeoutMs?: number; maxBytes?: number })
      })
  );
  registry.register(
    {
      id: "web.search",
      name: "Search web",
      description: "Search the web with a free configurable provider.",
      inputSchema: objectSchema
    },
    async ({ input }) =>
      searchWeb({
        timeoutMs: 15_000,
        maxBytes: 1_000_000,
        ...(input as { query: string; endpoint?: string; timeoutMs?: number; maxBytes?: number })
      })
  );
  registry.register(
    {
      id: "artifact.write",
      name: "Write artifact",
      description: "Generate a project artifact.",
      inputSchema: objectSchema
    },
    async ({ project, input }) => {
      const payload = input as Omit<Parameters<typeof writeArtifact>[0], "project">;
      return writeArtifact({
        ...payload,
        project
      });
    }
  );
  registry.register(
    {
      id: "skill.create",
      name: "Create skill",
      description: "Create a local skill skeleton inside the project workspace.",
      inputSchema: objectSchema
    },
    async ({ project, input }) =>
      createSkillSkeleton(project, input as Parameters<typeof createSkillSkeleton>[1])
  );
}
