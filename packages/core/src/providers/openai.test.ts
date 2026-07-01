import { describe, expect, it } from "vitest";

import { buildOpenAiChatRequest } from "./openai";
import type { ProviderRequest } from "./provider-types";

describe("openai provider conversion", () => {
  it("uses OpenAI chat-compatible message and tool shapes", () => {
    const request: ProviderRequest = {
      model: "gpt-4.1",
      systemPrompt: "Act carefully.",
      messages: [{ role: "user", content: "Create a plan" }],
      tools: [
        {
          name: "artifact.write",
          description: "Write an artifact",
          inputSchema: { type: "object", properties: {} }
        }
      ]
    };

    const body = buildOpenAiChatRequest(request);

    expect(body.model).toBe("gpt-4.1");
    expect(body.messages[0]).toEqual({
      role: "system",
      content: "Act carefully."
    });
    expect(body.tools?.[0]?.type).toBe("function");
  });
});
