import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkspacePage } from "./workspace-page";

describe("WorkspacePage", () => {
  it("renders sessions, conversation, tool calls, and artifact cards", () => {
    const html = renderToStaticMarkup(
      <WorkspacePage
        selectedProject={{
          id: "project-1",
          name: "Harness",
          workspacePath: "/tmp/harness",
          createdAt: "2026-06-29T00:00:00.000Z",
          updatedAt: "2026-06-29T00:00:00.000Z"
        }}
        sessions={[
          {
            id: "session-1",
            projectId: "project-1",
            title: "Draft report",
            status: "completed",
            providerProfileId: "deepseek",
            messages: [
              {
                id: "message-1",
                role: "assistant",
                content: "Generated a concise workspace summary and created an artifact.",
                createdAt: "2026-06-29T00:00:00.000Z"
              }
            ],
            artifactIds: ["artifact-1"],
            createdAt: "2026-06-29T00:00:00.000Z",
            updatedAt: "2026-06-29T00:00:00.000Z"
          }
        ]}
        activeSession={{
          id: "session-1",
          projectId: "project-1",
          title: "Draft report",
          status: "completed",
          providerProfileId: "deepseek",
          messages: [
            {
              id: "message-1",
              role: "assistant",
              content: "Generated a concise workspace summary and created an artifact.",
              createdAt: "2026-06-29T00:00:00.000Z"
            }
          ],
          artifactIds: ["artifact-1"],
          createdAt: "2026-06-29T00:00:00.000Z",
          updatedAt: "2026-06-29T00:00:00.000Z"
        }}
        artifacts={[
          {
            id: "artifact-1",
            kind: "pdf",
            title: "report.pdf",
            mimeType: "application/pdf",
            downloadUrl: "/api/artifacts/artifact-1"
          }
        ]}
      />
    );

    expect(html).toContain("Session history");
    expect(html).toContain("Ask the local agent");
    expect(html).toContain("Runtime state");
    expect(html).toContain("Artifacts");
    expect(html).toContain("report.pdf");
  });
});
