import type {
  ProviderMessage,
  ProviderProfile,
  ProviderRequest,
  ProviderTool
} from "./provider-types";

export interface OpenAiCompatibleChatRequest {
  model: string;
  messages: Array<{
    role: ProviderMessage["role"];
    content: string;
    tool_call_id?: string;
  }>;
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: ProviderTool["inputSchema"];
    };
  }>;
  temperature?: number;
  max_tokens?: number;
}

export const DEEPSEEK_PRESET: ProviderProfile = {
  id: "deepseek",
  name: "DeepSeek",
  kind: "openai-compatible",
  baseUrl: "https://api.deepseek.com",
  apiKeyEnv: "DEEPSEEK_API_KEY",
  model: "deepseek-chat"
};

function toOpenAiMessages(request: ProviderRequest): OpenAiCompatibleChatRequest["messages"] {
  const messages: OpenAiCompatibleChatRequest["messages"] = [];
  const trimmedSystemPrompt = request.systemPrompt.trim();

  if (trimmedSystemPrompt.length > 0) {
    messages.push({ role: "system", content: trimmedSystemPrompt });
  }

  for (const message of request.messages) {
    messages.push({
      role: message.role,
      content: message.content,
      ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {})
    });
  }

  return messages;
}

function toOpenAiTools(request: ProviderRequest): OpenAiCompatibleChatRequest["tools"] {
  if (request.tools.length === 0) {
    return undefined;
  }

  return request.tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }));
}

export function buildOpenAiCompatibleChatRequest(
  request: ProviderRequest
): OpenAiCompatibleChatRequest {
  return {
    model: request.model,
    messages: toOpenAiMessages(request),
    ...(request.tools.length > 0 ? { tools: toOpenAiTools(request) } : {}),
    ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
    ...(request.maxTokens === undefined ? {} : { max_tokens: request.maxTokens })
  };
}
