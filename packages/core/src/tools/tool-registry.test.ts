import { describe, expect, it } from "vitest";

import { ToolRegistry } from "./tool-registry";
import type { ToolDefinition } from "./tool-types";

const definition: ToolDefinition = {
  id: "filesystem.list",
  name: "List files",
  description: "List files in the project workspace",
  inputSchema: {
    type: "object",
    properties: { path: { type: "string" } }
  }
};

describe("ToolRegistry", () => {
  it("registers, lists, and calls tools", async () => {
    const registry = new ToolRegistry();
    registry.register(definition, async ({ input }) => ({
      files: [`${(input as { path: string }).path}/README.md`]
    }));

    expect(registry.list(["filesystem.list"])).toEqual([definition]);
    await expect(
      registry.call("filesystem.list", {
        project: {
          id: "project-1",
          name: "Project",
          workspacePath: "/tmp/project",
          createdAt: "2026-06-29T00:00:00.000Z",
          updatedAt: "2026-06-29T00:00:00.000Z"
        },
        input: { path: "." }
      })
    ).resolves.toEqual({ files: ["./README.md"] });
  });

  it("throws a normalized error for missing tools", async () => {
    const registry = new ToolRegistry();

    await expect(
      registry.call("missing", {
        project: {
          id: "project-1",
          name: "Project",
          workspacePath: "/tmp/project",
          createdAt: "2026-06-29T00:00:00.000Z",
          updatedAt: "2026-06-29T00:00:00.000Z"
        },
        input: {}
      })
    ).rejects.toThrow("Tool not found: missing");
  });
});
