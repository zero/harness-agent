import { describe, expect, it } from "vitest";

import {
  DEEPSEEK_PRESET,
  buildOpenAiCompatibleChatRequest
} from "./openai-compatible";
import type { ProviderRequest } from "./provider-types";

const request: ProviderRequest = {
  model: "deepseek-chat",
  systemPrompt: "You are a local engineering agent.",
  messages: [
    {
      role: "user",
      content: "List project files"
    }
  ],
  tools: [
    {
      name: "filesystem.list",
      description: "List files in the project workspace",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" }
        },
        required: ["path"]
      }
    }
  ]
};

describe("openai-compatible provider conversion", () => {
  it("builds a chat completions request with model, messages, and tools", () => {
    const body = buildOpenAiCompatibleChatRequest(request);

    expect(body.model).toBe("deepseek-chat");
    expect(body.messages).toEqual([
      { role: "system", content: "You are a local engineering agent." },
      { role: "user", content: "List project files" }
    ]);
    expect(body.tools).toEqual([
      {
        type: "function",
        function: {
          name: "filesystem.list",
          description: "List files in the project workspace",
          parameters: request.tools[0]?.inputSchema
        }
      }
    ]);
  });

  it("ships a DeepSeek OpenAI-compatible preset", () => {
    expect(DEEPSEEK_PRESET).toMatchObject({
      id: "deepseek",
      name: "DeepSeek",
      kind: "openai-compatible",
      baseUrl: "https://api.deepseek.com",
      apiKeyEnv: "DEEPSEEK_API_KEY"
    });
  });
});
