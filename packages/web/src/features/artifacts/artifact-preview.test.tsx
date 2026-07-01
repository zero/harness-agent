import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ArtifactPreview } from "./artifact-preview";
import type { ArtifactViewModel } from "./artifact-types";

const base = {
  id: "artifact-1",
  title: "Report",
  mimeType: "text/plain",
  downloadUrl: "/api/artifacts/artifact-1"
};

describe("ArtifactPreview", () => {
  it.each([
    { kind: "markdown", expected: "markdown-body" },
    { kind: "html", expected: "sandbox" },
    { kind: "csv", expected: "<table" },
    { kind: "xlsx", expected: "<table" },
    { kind: "docx", expected: "Document preview" },
    { kind: "pptx", expected: "Slide preview" },
    { kind: "pdf", expected: "<embed" },
    { kind: "json", expected: "{&quot;ok&quot;:true}" },
    { kind: "text", expected: "plain text" },
    { kind: "image", expected: "<img" }
  ] as Array<{ kind: ArtifactViewModel["kind"]; expected: string }>)(
    "renders $kind previews",
    ({ kind, expected }) => {
      const artifact: ArtifactViewModel = {
        ...base,
        kind,
        content: kind === "json" ? "{\"ok\":true}" : "plain text",
        rows: [{ name: "alpha", value: 1 }]
      };

      expect(renderToStaticMarkup(<ArtifactPreview artifact={artifact} />)).toContain(expected);
    }
  );
});
