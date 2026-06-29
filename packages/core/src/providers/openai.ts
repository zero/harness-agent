import {
  buildOpenAiCompatibleChatRequest,
  type OpenAiCompatibleChatRequest
} from "./openai-compatible";
import type { ProviderRequest } from "./provider-types";

export type OpenAiChatRequest = OpenAiCompatibleChatRequest;

export function buildOpenAiChatRequest(request: ProviderRequest): OpenAiChatRequest {
  return buildOpenAiCompatibleChatRequest(request);
}
