import { mkdirSync, mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Project } from "@harness-agent/core";

export function createTempProject(): Project {
  const workspacePath = realpathSync(mkdtempSync(join(tmpdir(), "harness-tools-")));
  mkdirSync(join(workspacePath, "src"), { recursive: true });

  return {
    id: "project-1",
    name: "Tools Project",
    workspacePath,
    createdAt: "2026-06-29T00:00:00.000Z",
    updatedAt: "2026-06-29T00:00:00.000Z"
  };
}
