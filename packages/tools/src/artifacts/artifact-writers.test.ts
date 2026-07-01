import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { writeArtifact } from "./artifact-writers";
import { createTempProject } from "../test-utils";
import type { ArtifactKind } from "@harness-agent/core";

const cases: Array<{ kind: ArtifactKind; title: string; expectedMime: string }> = [
  { kind: "markdown", title: "Markdown Report", expectedMime: "text/markdown" },
  { kind: "html", title: "HTML Report", expectedMime: "text/html" },
  { kind: "csv", title: "CSV Report", expectedMime: "text/csv" },
  {
    kind: "xlsx",
    title: "Workbook",
    expectedMime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  },
  {
    kind: "docx",
    title: "Document",
    expectedMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  },
  {
    kind: "pptx",
    title: "Deck",
    expectedMime: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  },
  { kind: "pdf", title: "PDF Report", expectedMime: "application/pdf" },
  { kind: "json", title: "JSON Report", expectedMime: "application/json" },
  { kind: "text", title: "Text Report", expectedMime: "text/plain" }
];

describe("artifact writers", () => {
  it.each(cases)("writes $kind artifacts inside the project workspace", async (item) => {
    const project = createTempProject();
    const artifact = await writeArtifact({
      project,
      sessionId: "session-1",
      kind: item.kind,
      title: item.title,
      content: "Hello artifact",
      rows: [{ name: "alpha", value: 1 }]
    });

    expect(artifact.mimeType).toBe(item.expectedMime);
    expect(artifact.relativePath).toContain(".harness-agent/artifacts/session-1");
    expect(existsSync(join(project.workspacePath, artifact.relativePath))).toBe(true);
    expect(artifact.sizeBytes).toBeGreaterThan(0);
  });

  it("writes PDF artifacts when content contains unicode text", async () => {
    const project = createTempProject();
    const artifact = await writeArtifact({
      project,
      sessionId: "session-1",
      kind: "pdf",
      title: "中文 PDF 报告",
      content: "生成一个本地闭环 smoke report",
      rows: []
    });

    const bytes = readFileSync(join(project.workspacePath, artifact.relativePath));

    expect(artifact.mimeType).toBe("application/pdf");
    expect(bytes.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });

  it("preserves complete HTML documents for previewable report artifacts", async () => {
    const project = createTempProject();
    const html = "<!doctype html><html><body><h1>Quarterly Report</h1></body></html>";

    const artifact = await writeArtifact({
      project,
      sessionId: "session-1",
      kind: "html",
      title: "HTML Report",
      content: html
    });

    expect(readFileSync(join(project.workspacePath, artifact.relativePath), "utf8")).toBe(html);
  });
});
