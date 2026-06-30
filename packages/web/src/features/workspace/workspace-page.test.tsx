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
        isRunning
        artifacts={[
          {
            id: "artifact-1",
            kind: "pdf",
            title: "report.pdf",
            mimeType: "application/pdf",
            downloadUrl: "/api/artifacts/artifact-1"
          }
        ]}
        events={[
          {
            type: "thinking",
            summary: "Understanding the request and checking enabled capabilities."
          },
          {
            type: "skill.match",
            skillName: "writer",
            path: "/tmp/skills/writer",
            reason: "Prompt matched an enabled skill."
          },
          {
            type: "tool.call",
            callId: "call-1",
            toolName: "filesystem.list",
            input: { path: "." }
          },
          {
            type: "tool.result",
            callId: "call-1",
            toolName: "filesystem.list",
            output: { entries: ["report.pdf"] }
          }
        ]}
      />
    );

    expect(html).toContain("Projects");
    expect(html).toContain("Runs");
    expect(html).toContain("Harness Agent");
    expect(html).toContain("Generated artifacts");
    expect(html).toContain("Context");
    expect(html).toContain("aria-label=\"Harness Agent thinking\"");
    expect(html).toContain("Agent process");
    expect(html).toContain("4 process events");
    expect(html).toContain("Thinking: Understanding the request");
    expect(html).toContain("Matched skill writer");
    expect(html).toContain("Calling filesystem.list");
    expect(html).toContain("Completed filesystem.list");
    expect(html).toContain("Process detail for Calling filesystem.list");
    expect(html).toContain("&quot;path&quot;: &quot;.&quot;");
    expect(html).toContain("Process detail for Completed filesystem.list");
    expect(html).toContain("&quot;entries&quot;");
    expect(html).not.toContain(">Process<");
    expect(html).toContain("report.pdf");
  });

  it("keeps process events in chronological order for the assistant turn they belong to", () => {
    const html = renderToStaticMarkup(
      <WorkspacePage
        selectedProject={{
          id: "project-1",
          name: "Harness",
          workspacePath: "/tmp/harness",
          createdAt: "2026-06-29T00:00:00.000Z",
          updatedAt: "2026-06-29T00:00:00.000Z"
        }}
        activeSession={{
          id: "session-1",
          projectId: "project-1",
          title: "Count repositories",
          status: "completed",
          providerProfileId: "deepseek",
          messages: [
            {
              id: "message-1-assistant",
              role: "assistant",
              content: "First answer.",
              createdAt: "2026-06-29T00:00:00.000Z"
            },
            {
              id: "message-2-assistant",
              role: "assistant",
              content: "Second answer.",
              createdAt: "2026-06-29T00:01:00.000Z"
            }
          ],
          artifactIds: [],
          createdAt: "2026-06-29T00:00:00.000Z",
          updatedAt: "2026-06-29T00:01:00.000Z"
        }}
        events={[
          { type: "session.started", sessionId: "session-1" },
          { type: "thinking", summary: "Preparing first answer." },
          { type: "message.completed", messageId: "message-1" },
          { type: "session.completed", sessionId: "session-1" },
          { type: "session.started", sessionId: "session-1" },
          { type: "thinking", summary: "Counting repositories." },
          {
            type: "tool.call",
            callId: "call-1",
            toolName: "command.execute",
            input: { command: "find . -name .git" }
          },
          {
            type: "tool.result",
            callId: "call-1",
            toolName: "command.execute",
            output: { exitCode: 0, stdout: "42\n" }
          },
          { type: "message.completed", messageId: "message-2" },
          { type: "session.completed", sessionId: "session-1" }
        ]}
      />
    );

    const secondAnswerIndex = html.indexOf("Second answer.");
    const secondProcessIndex = html.indexOf("Agent process", secondAnswerIndex);
    const secondProcessHtml = html.slice(secondProcessIndex, html.indexOf("</article>", secondProcessIndex));

    expect(secondProcessHtml).toContain("5 process events");
    expect(secondProcessHtml).not.toMatch(/^.*Session completed.*Session started/s);
    expect(secondProcessHtml.indexOf("Session started")).toBeLessThan(
      secondProcessHtml.indexOf("Thinking: Counting repositories.")
    );
    expect(secondProcessHtml.indexOf("Thinking: Counting repositories.")).toBeLessThan(
      secondProcessHtml.indexOf("Calling command.execute")
    );
    expect(secondProcessHtml.indexOf("Calling command.execute")).toBeLessThan(
      secondProcessHtml.indexOf("Completed command.execute")
    );
    expect(secondProcessHtml.indexOf("Completed command.execute")).toBeLessThan(
      secondProcessHtml.indexOf("Session completed")
    );
  });
});
