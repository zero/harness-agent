import type { ConversationMessageDto, TaskSessionDto } from "@/lib/api-client";

export function upsertOptimisticUserMessage(
  sessions: TaskSessionDto[],
  session: TaskSessionDto,
  message: ConversationMessageDto
): TaskSessionDto[] {
  const existingMessages = session.messages.some((item) => item.id === message.id)
    ? session.messages
    : [...session.messages, message];
  const optimisticSession: TaskSessionDto = {
    ...session,
    status: "running",
    messages: existingMessages,
    updatedAt: message.createdAt
  };

  return [optimisticSession, ...sessions.filter((item) => item.id !== session.id)];
}
