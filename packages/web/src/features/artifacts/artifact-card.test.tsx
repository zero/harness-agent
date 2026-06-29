import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ArtifactCard } from "./artifact-card";

describe("ArtifactCard", () => {
  it("renders artifact title, kind, and actions", () => {
    const html = renderToStaticMarkup(
      <ArtifactCard
        artifact={{
          id: "artifact-1",
          kind: "pdf",
          title: "report.pdf",
          mimeType: "application/pdf",
          downloadUrl: "/api/artifacts/artifact-1"
        }}
      />
    );

    expect(html).toContain("report.pdf");
    expect(html).toContain("pdf");
    expect(html).toContain("Preview");
  });
});
