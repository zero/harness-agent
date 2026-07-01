import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  isPathInsideProject,
  resolveProjectPath
} from "./project-policy";
import type { Project } from "./project-types";

function createProject(): Project {
  const workspacePath = realpathSync(mkdtempSync(join(tmpdir(), "harness-project-")));
  return {
    id: "project-1",
    name: "Test Project",
    workspacePath,
    createdAt: "2026-06-29T00:00:00.000Z",
    updatedAt: "2026-06-29T00:00:00.000Z"
  };
}

describe("project policy", () => {
  it("resolves paths inside the project workspace", () => {
    const project = createProject();
    const resolved = resolveProjectPath(project, "src/index.ts");

    expect(resolved).toContain(project.workspacePath);
    expect(resolved.endsWith("src/index.ts")).toBe(true);
  });

  it("rejects traversal outside the project workspace", () => {
    const project = createProject();

    expect(() => resolveProjectPath(project, "../outside.txt")).toThrow(
      "outside project workspace"
    );
  });

  it("detects whether existing paths are inside the project workspace", () => {
    const project = createProject();
    const insidePath = join(project.workspacePath, "inside.txt");
    const outsidePath = join(tmpdir(), "outside-harness-agent.txt");
    writeFileSync(insidePath, "inside");
    writeFileSync(outsidePath, "outside");

    expect(isPathInsideProject(project, insidePath)).toBe(true);
    expect(isPathInsideProject(project, outsidePath)).toBe(false);
  });
});
