import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProjectsPage } from "./projects-page";

describe("ProjectsPage", () => {
  it("renders project creation and workspace selection UI", () => {
    const html = renderToStaticMarkup(
      <ProjectsPage
        projects={[
          {
            id: "project-1",
            name: "Harness",
            workspacePath: "/tmp/harness",
            createdAt: "2026-06-29T00:00:00.000Z",
            updatedAt: "2026-06-29T00:00:00.000Z"
          }
        ]}
        onDeleteProject={() => undefined}
      />
    );

    expect(html).toContain("Projects");
    expect(html).toContain("Workspace path");
    expect(html).toContain("Browse workspace");
    expect(html).toContain("Create project");
    expect(html).toContain("Delete Harness");
    expect(html).toContain("/tmp/harness");
  });
});
