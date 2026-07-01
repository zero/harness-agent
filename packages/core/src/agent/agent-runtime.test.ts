import { describe, expect, it } from "vitest";

import { AgentRuntime } from "./agent-runtime";
import { ToolRegistry } from "../tools/tool-registry";
import type { LlmProvider, ProviderEvent, ProviderRequest } from "../providers/provider-types";

function fakeProvider(): LlmProvider {
  return {
    id: "fake",
    async *complete(_request: ProviderRequest): AsyncIterable<ProviderEvent> {
      yield { type: "message.delta", text: "I will inspect files." };
      yield {
        type: "tool.call",
        id: "call-1",
        name: "filesystem.list",
        input: { path: "." }
      };
      yield { type: "message.delta", text: "I found README.md." };
      yield { type: "message.completed" };
    }
  };
}

describe("AgentRuntime", () => {
  it("streams session, message, tool, and completion events", async () => {
    const tools = new ToolRegistry();
    tools.register(
      {
        id: "filesystem.list",
        name: "List files",
        description: "List files",
        inputSchema: { type: "object", properties: {} }
      },
      async () => ({ files: ["README.md"] })
    );
    const runtime = new AgentRuntime({
      provider: fakeProvider(),
      tools,
      maxSteps: 4
    });

    const events = [];
    for await (const event of runtime.runTask({
      sessionId: "session-1",
      messageId: "message-1",
      project: {
        id: "project-1",
        name: "Project",
        workspacePath: "/tmp/project",
        createdAt: "2026-06-29T00:00:00.000Z",
        updatedAt: "2026-06-29T00:00:00.000Z"
      },
      providerRequest: {
        model: "fake",
        systemPrompt: "Help locally.",
        messages: [{ role: "user", content: "List files" }],
        tools: []
      }
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual([
      "session.started",
      "message.delta",
      "tool.call",
      "tool.result",
      "message.delta",
      "message.completed",
      "session.completed"
    ]);
  });
});
