import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import { createServerApp } from "../app";
import { createTempDataDir, createTempWorkspace } from "../test-utils";

describe("local agent smoke", () => {
  it("runs the default local runtime and persists previewable artifacts", async () => {
    const app = createServerApp({ dataDir: createTempDataDir() });
    const workspacePath = createTempWorkspace();
    const project = await (
      await app.request("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Smoke Project", workspacePath }),
        headers: { "content-type": "application/json" }
      })
    ).json();
    const session = await (
      await app.request("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ projectId: project.id, title: "Generate artifacts" }),
        headers: { "content-type": "application/json" }
      })
    ).json();

    const messageResponse = await app.request(`/api/sessions/${session.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "make a local report" }),
      headers: { "content-type": "application/json" }
    });
    const updatedSession = await (await app.request(`/api/sessions/${session.id}`)).json();

    expect(messageResponse.status).toBe(200);
    expect(updatedSession.artifactIds).toEqual(
      expect.arrayContaining([
        "artifact-session-1-local-task-summary",
        "artifact-session-1-local-task-brief"
      ])
    );
    expect(updatedSession.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: expect.stringContaining("Generated local artifacts")
        })
      ])
    );

    const artifacts = (await (
      await app.request(`/api/artifacts?sessionId=${session.id}`)
    ).json()) as { id: string; kind: string }[];
    expect(artifacts.map((artifact) => artifact.kind)).toEqual(
      expect.arrayContaining(["markdown", "csv", "xlsx", "docx", "pptx", "pdf"])
    );

    const markdownPreview = await (
      await app.request("/api/artifacts/artifact-session-1-local-task-summary/preview")
    ).json();
    expect(markdownPreview).toMatchObject({
      kind: "markdown",
      content: expect.stringContaining("make a local report")
    });

    const pdfResponse = await app.request("/api/artifacts/artifact-session-1-local-task-brief");
    const pdfHeader = Buffer.from(await pdfResponse.arrayBuffer()).subarray(0, 4).toString("utf8");

    expect(pdfResponse.headers.get("content-type")).toContain("application/pdf");
    expect(pdfHeader).toBe("%PDF");
  });
});
