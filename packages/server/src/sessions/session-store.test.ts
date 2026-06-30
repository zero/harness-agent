import { describe, expect, it } from "vitest";
import { join } from "node:path";

import { SessionStore } from "./session-store";
import { createTempDataDir } from "../test-utils";

describe("SessionStore", () => {
  it("creates sessions and appends events", () => {
    const store = new SessionStore([]);
    const session = store.create({
      projectId: "project-1",
      title: "Inspect workspace",
      providerProfileId: "deepseek"
    });

    store.appendEvent(session.id, { type: "session.started", sessionId: session.id });

    expect(store.list("project-1")).toHaveLength(1);
    expect(store.events(session.id)).toEqual([
      { type: "session.started", sessionId: session.id }
    ]);
  });

  it("persists sessions, messages, artifact ids, and events in sqlite storage", () => {
    const dbPath = join(createTempDataDir(), "conversations.sqlite");
    const firstStore = new SessionStore([], dbPath);
    const session = firstStore.create({
      projectId: "project-1",
      title: "Persistent chat",
      providerProfileId: "doubao"
    });
    firstStore.appendMessage(session.id, {
      id: "message-1",
      role: "user",
      content: "当前目录有哪些文件？",
      createdAt: "2026-06-30T00:00:00.000Z"
    });
    firstStore.appendEvent(session.id, {
      type: "tool.call",
      callId: "call-1",
      toolName: "filesystem.list",
      input: { path: "." }
    });
    firstStore.update(session.id, {
      status: "completed",
      artifactIds: ["artifact-1"]
    });

    const secondStore = new SessionStore([], dbPath);
    const restored = secondStore.get(session.id);

    expect(secondStore.list("project-1")).toHaveLength(1);
    expect(restored).toMatchObject({
      id: session.id,
      projectId: "project-1",
      title: "Persistent chat",
      status: "completed",
      artifactIds: ["artifact-1"],
      messages: [
        {
          id: "message-1",
          role: "user",
          content: "当前目录有哪些文件？"
        }
      ]
    });
    expect(secondStore.events(session.id)).toEqual([
      {
        type: "tool.call",
        callId: "call-1",
        toolName: "filesystem.list",
        input: { path: "." }
      }
    ]);
  });
});
