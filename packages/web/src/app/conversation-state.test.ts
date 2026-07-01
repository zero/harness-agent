import { describe, expect, it } from "vitest";

import { upsertOptimisticUserMessage } from "./conversation-state";
import type { ConversationMessageDto, TaskSessionDto } from "@/lib/api-client";

function session(overrides: Partial<TaskSessionDto> = {}): TaskSessionDto {
  return {
    id: "session-1",
    projectId: "project-1",
    title: "Inspect workspace",
    status: "completed",
    providerProfileId: "doubao",
    messages: [],
    artifactIds: [],
    createdAt: "2026-06-30T00:00:00.000Z",
    updatedAt: "2026-06-30T00:00:00.000Z",
    ...overrides
  };
}

describe("conversation state", () => {
  it("adds the user's message and running status before the server reply arrives", () => {
    const message: ConversationMessageDto = {
      id: "client-message-1",
      role: "user",
      content: "当前目录有哪些文件？",
      createdAt: "2026-06-30T00:00:01.000Z"
    };

    const sessions = upsertOptimisticUserMessage([session()], session(), message);

    expect(sessions[0]).toMatchObject({
      id: "session-1",
      status: "running",
      messages: [message],
      updatedAt: "2026-06-30T00:00:01.000Z"
    });
  });

  it("does not duplicate the same optimistic message when polling refreshes state", () => {
    const message: ConversationMessageDto = {
      id: "client-message-1",
      role: "user",
      content: "hello",
      createdAt: "2026-06-30T00:00:01.000Z"
    };
    const existing = session({ messages: [message] });

    const sessions = upsertOptimisticUserMessage([existing], existing, message);

    expect(sessions[0]?.messages).toEqual([message]);
  });
});
