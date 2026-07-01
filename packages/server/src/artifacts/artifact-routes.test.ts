import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createServerApp } from "../app";
import { createTempDataDir, createTempWorkspace } from "../test-utils";
import type { Artifact, Project } from "@harness-agent/core";

function project(workspacePath: string): Project {
  return {
    id: "project-1",
    name: "Project",
    workspacePath,
    createdAt: "2026-06-29T00:00:00.000Z",
    updatedAt: "2026-06-29T00:00:00.000Z"
  };
}

function artifact(relativePath: string): Artifact {
  return {
    id: "artifact-1",
    projectId: "project-1",
    sessionId: "session-1",
    kind: "markdown",
    title: "Report",
    relativePath,
    mimeType: "text/markdown",
    sizeBytes: 12,
    createdAt: "2026-06-29T00:00:00.000Z"
  };
}

describe("artifact routes", () => {
  it("downloads and previews artifacts inside the project workspace", async () => {
    const workspacePath = createTempWorkspace();
    const relativePath = ".harness-agent/artifacts/session-1/report.md";
    mkdirSync(join(workspacePath, ".harness-agent/artifacts/session-1"), { recursive: true });
    writeFileSync(join(workspacePath, relativePath), "# Report");
    const app = createServerApp({
      dataDir: createTempDataDir(),
      initialProjects: [project(workspacePath)],
      initialArtifacts: [artifact(relativePath)]
    });

    expect(await (await app.request("/api/artifacts/artifact-1")).text()).toBe("# Report");
    expect(await (await app.request("/api/artifacts/artifact-1/preview")).json()).toMatchObject({
      kind: "markdown",
      content: "# Report"
    });
  });

  it("rejects artifacts outside the owning project workspace", async () => {
    const app = createServerApp({
      dataDir: createTempDataDir(),
      initialProjects: [project(createTempWorkspace())],
      initialArtifacts: [artifact("../outside.md")]
    });

    const response = await app.request("/api/artifacts/artifact-1");

    expect(response.status).toBe(400);
  });
});
