import { describe, expect, it } from "vitest";

import { SessionStore } from "./session-store";

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
});
