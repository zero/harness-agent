import type { ProviderMessage, ProviderRequest, ProviderTool } from "./provider-types";

export interface AnthropicMessagesRequest {
  model: string;
  system: string;
  max_tokens: number;
  messages: Array<{
    role: Extract<ProviderMessage["role"], "user" | "assistant">;
    content: string;
  }>;
  tools?: Array<{
    name: string;
    description: string;
    input_schema: ProviderTool["inputSchema"];
  }>;
  temperature?: number;
}

export function buildAnthropicMessagesRequest(
  request: ProviderRequest
): AnthropicMessagesRequest {
  return {
    model: request.model,
    system: request.systemPrompt,
    max_tokens: request.maxTokens ?? 4096,
    messages: request.messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content
      })),
    ...(request.tools.length > 0
      ? {
          tools: request.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema
          }))
        }
      : {}),
    ...(request.temperature === undefined ? {} : { temperature: request.temperature })
  };
}
