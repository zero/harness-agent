import { describe, expect, it } from "vitest";

import { createServerApp } from "../app";
import { createTempDataDir, createTempWorkspace } from "../test-utils";
import type { AgentEvent } from "@harness-agent/core";

describe("session routes", () => {
  it("creates a session, runs a message through runtime, and replays SSE events", async () => {
    const app = createServerApp({
      dataDir: createTempDataDir(),
      runtime: {
        async *runTask({ sessionId }: { sessionId: string }): AsyncIterable<AgentEvent> {
          yield { type: "session.started", sessionId };
          yield { type: "message.delta", messageId: "message-1", text: "hello" };
          yield { type: "session.completed", sessionId };
        }
      }
    });
    const workspacePath = createTempWorkspace();
    const project = await (
      await app.request("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Local Project", workspacePath }),
        headers: { "content-type": "application/json" }
      })
    ).json();
    const session = await (
      await app.request("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ projectId: project.id, title: "Run task" }),
        headers: { "content-type": "application/json" }
      })
    ).json();

    const messageResponse = await app.request(`/api/sessions/${session.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "hello" }),
      headers: { "content-type": "application/json" }
    });
    expect(messageResponse.status).toBe(200);

    const events = await app.request(`/api/sessions/${session.id}/events`);
    const body = await events.text();

    expect(events.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain("session.started");
    expect(body).toContain("message.delta");
  });
});
