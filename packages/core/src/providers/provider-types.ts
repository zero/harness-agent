export type JsonObjectSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export interface ProviderMessage {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  toolCallId?: string;
}

export interface ProviderTool {
  name: string;
  description: string;
  inputSchema: JsonObjectSchema;
}

export interface ProviderRequest {
  model: string;
  systemPrompt: string;
  messages: ProviderMessage[];
  tools: ProviderTool[];
  temperature?: number;
  maxTokens?: number;
}

export type ProviderEvent =
  | { type: "message.delta"; text: string }
  | {
      type: "tool.call";
      id: string;
      name: string;
      input: unknown;
    }
  | { type: "message.completed" }
  | { type: "error"; message: string };

export type ProviderKind = "openai" | "anthropic" | "openai-compatible";

export interface ProviderProfile {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  apiKeyEnv: string;
  model: string;
}

export interface LlmProvider {
  id: string;
  complete(request: ProviderRequest): AsyncIterable<ProviderEvent>;
}
