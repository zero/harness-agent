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
      body: JSON.stringify({ content: "生成一个本地闭环 smoke report" }),
      headers: { "content-type": "application/json" }
    });
    const updatedSession = await (await app.request(`/api/sessions/${session.id}`)).json();
    const summaryArtifactId = `artifact-${session.id}-local-task-summary`;
    const pdfArtifactId = `artifact-${session.id}-local-task-brief`;

    expect(messageResponse.status).toBe(200);
    expect(updatedSession.artifactIds).toEqual(
      expect.arrayContaining([summaryArtifactId, pdfArtifactId])
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
      await app.request(`/api/artifacts/${summaryArtifactId}/preview`)
    ).json();
    expect(markdownPreview).toMatchObject({
      kind: "markdown",
      content: expect.stringContaining("生成一个本地闭环 smoke report")
    });

    const pdfResponse = await app.request(`/api/artifacts/${pdfArtifactId}`);
    const pdfHeader = Buffer.from(await pdfResponse.arrayBuffer()).subarray(0, 4).toString("utf8");

    expect(pdfResponse.headers.get("content-type")).toContain("application/pdf");
    expect(pdfHeader).toBe("%PDF");
  });
});
