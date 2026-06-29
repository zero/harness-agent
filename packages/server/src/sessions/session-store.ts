import type { AgentEvent, ConversationMessage, TaskSession } from "@harness-agent/core";

export interface CreateSessionInput {
  projectId: string;
  title: string;
  providerProfileId: string;
}

export class SessionStore {
  private readonly sessions = new Map<string, TaskSession>();
  private readonly eventLog = new Map<string, AgentEvent[]>();
  private nextId = 1;

  constructor(initialSessions: TaskSession[] = []) {
    for (const session of initialSessions) {
      this.sessions.set(session.id, session);
      this.eventLog.set(session.id, []);
    }
  }

  create(input: CreateSessionInput): TaskSession {
    const now = new Date().toISOString();
    const session: TaskSession = {
      id: `session-${this.nextId}`,
      projectId: input.projectId,
      title: input.title,
      status: "queued",
      providerProfileId: input.providerProfileId,
      messages: [],
      artifactIds: [],
      createdAt: now,
      updatedAt: now
    };
    this.nextId += 1;
    this.sessions.set(session.id, session);
    this.eventLog.set(session.id, []);
    return session;
  }

  get(id: string): TaskSession | undefined {
    return this.sessions.get(id);
  }

  list(projectId?: string): TaskSession[] {
    return [...this.sessions.values()].filter(
      (session) => !projectId || session.projectId === projectId
    );
  }

  update(id: string, patch: Partial<TaskSession>): TaskSession {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }
    const updated = {
      ...session,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    this.sessions.set(id, updated);
    return updated;
  }

  appendMessage(sessionId: string, message: ConversationMessage): void {
    const session = this.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    this.update(sessionId, {
      messages: [...session.messages, message]
    });
  }

  appendEvent(sessionId: string, event: AgentEvent): void {
    const events = this.eventLog.get(sessionId) ?? [];
    events.push(event);
    this.eventLog.set(sessionId, events);
  }

  events(sessionId: string): AgentEvent[] {
    return [...(this.eventLog.get(sessionId) ?? [])];
  }
}
