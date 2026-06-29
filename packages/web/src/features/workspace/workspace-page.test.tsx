import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkspacePage } from "./workspace-page";

describe("WorkspacePage", () => {
  it("renders sessions, conversation, tool calls, and artifact cards", () => {
    const html = renderToStaticMarkup(<WorkspacePage />);

    expect(html).toContain("Session history");
    expect(html).toContain("Ask the local agent");
    expect(html).toContain("filesystem.list");
    expect(html).toContain("Artifacts");
    expect(html).toContain("report.pdf");
  });
});
