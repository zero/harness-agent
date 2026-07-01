import { describe, expect, it } from "vitest";

import { ArtifactRegistry } from "./artifact-registry";

describe("ArtifactRegistry", () => {
  it("stores artifacts by project and session", () => {
    const registry = new ArtifactRegistry();
    const artifact = registry.register({
      sessionId: "session-1",
      projectId: "project-1",
      kind: "markdown",
      title: "Report",
      relativePath: ".harness-agent/artifacts/session-1/report.md",
      mimeType: "text/markdown",
      sizeBytes: 42
    });

    expect(artifact.id).toMatch(/^artifact-/);
    expect(registry.listForSession("session-1")).toEqual([artifact]);
    expect(registry.get(artifact.id)).toEqual(artifact);
  });
});
