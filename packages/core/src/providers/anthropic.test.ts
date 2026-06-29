import { describe, expect, it } from "vitest";

import { buildAnthropicMessagesRequest } from "./anthropic";
import type { ProviderRequest } from "./provider-types";

describe("anthropic provider conversion", () => {
  it("maps system prompt, messages, and tools to Anthropic Messages format", () => {
    const request: ProviderRequest = {
      model: "claude-sonnet-4-5",
      systemPrompt: "Use tools only inside the project.",
      messages: [{ role: "user", content: "Search the workspace" }],
      tools: [
        {
          name: "filesystem.search",
          description: "Search files",
          inputSchema: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"]
          }
        }
      ],
      maxTokens: 4096
    };

    const body = buildAnthropicMessagesRequest(request);

    expect(body).toEqual({
      model: "claude-sonnet-4-5",
      system: "Use tools only inside the project.",
      max_tokens: 4096,
      messages: [{ role: "user", content: "Search the workspace" }],
      tools: [
        {
          name: "filesystem.search",
          description: "Search files",
          input_schema: request.tools[0]?.inputSchema
        }
      ]
    });
  });
});
