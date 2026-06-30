import type { AgentEvent, ConversationMessage, TaskSession } from "@harness-agent/core";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface CreateSessionInput {
  projectId: string;
  title: string;
  providerProfileId: string;
}

export class SessionStore {
  private readonly sessions = new Map<string, TaskSession>();
  private readonly eventLog = new Map<string, AgentEvent[]>();
  private readonly db?: DatabaseSync;

  constructor(initialSessions: TaskSession[] = [], sqlitePath?: string) {
    if (sqlitePath) {
      mkdirSync(dirname(sqlitePath), { recursive: true });
      this.db = new DatabaseSync(sqlitePath);
      this.initializeSqlite();
    }

    for (const session of initialSessions) {
      if (this.db) {
        this.upsertSqliteSession(session);
        this.replaceSqliteMessages(session.id, session.messages);
      } else {
        this.sessions.set(session.id, session);
        this.eventLog.set(session.id, []);
      }
    }
  }

  create(input: CreateSessionInput): TaskSession {
    const now = new Date().toISOString();
    const session: TaskSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId: input.projectId,
      title: input.title,
      status: "queued",
      providerProfileId: input.providerProfileId,
      messages: [],
      artifactIds: [],
      createdAt: now,
      updatedAt: now
    };
    if (this.db) {
      this.upsertSqliteSession(session);
      return session;
    }
    this.sessions.set(session.id, session);
    this.eventLog.set(session.id, []);
    return session;
  }

  get(id: string): TaskSession | undefined {
    if (this.db) {
      return this.getSqliteSession(id);
    }
    return this.sessions.get(id);
  }

  list(projectId?: string): TaskSession[] {
    if (this.db) {
      return this.listSqliteSessions(projectId);
    }
    return [...this.sessions.values()].filter(
      (session) => !projectId || session.projectId === projectId
    );
  }

  update(id: string, patch: Partial<TaskSession>): TaskSession {
    const session = this.get(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }
    const updated = {
      ...session,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    if (this.db) {
      this.upsertSqliteSession(updated);
      if (patch.messages) {
        this.replaceSqliteMessages(id, patch.messages);
      }
      return updated;
    }
    this.sessions.set(id, updated);
    return updated;
  }

  appendMessage(sessionId: string, message: ConversationMessage): void {
    const session = this.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    if (this.db) {
      this.insertSqliteMessage(sessionId, message);
      this.update(sessionId, {});
      return;
    }
    this.update(sessionId, {
      messages: [...session.messages, message]
    });
  }

  appendEvent(sessionId: string, event: AgentEvent): void {
    if (this.db) {
      this.insertSqliteEvent(sessionId, event);
      return;
    }
    const events = this.eventLog.get(sessionId) ?? [];
    events.push(event);
    this.eventLog.set(sessionId, events);
  }

  events(sessionId: string): AgentEvent[] {
    if (this.db) {
      return this.listSqliteEvents(sessionId);
    }
    return [...(this.eventLog.get(sessionId) ?? [])];
  }

  deleteProject(projectId: string): void {
    if (this.db) {
      const rows = this.db
        .prepare("SELECT id FROM sessions WHERE project_id = ?")
        .all(projectId) as Array<{ id: string }>;
      for (const row of rows) {
        this.db.prepare("DELETE FROM session_events WHERE session_id = ?").run(row.id);
        this.db.prepare("DELETE FROM session_messages WHERE session_id = ?").run(row.id);
      }
      this.db.prepare("DELETE FROM sessions WHERE project_id = ?").run(projectId);
      return;
    }

    for (const session of this.sessions.values()) {
      if (session.projectId === projectId) {
        this.sessions.delete(session.id);
        this.eventLog.delete(session.id);
      }
    }
  }

  private initializeSqlite(): void {
    this.db?.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        provider_profile_id TEXT NOT NULL,
        artifact_ids TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_project_updated
        ON sessions(project_id, updated_at DESC);
      CREATE TABLE IF NOT EXISTS session_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_session_messages_session_position
        ON session_messages(session_id, position ASC);
      CREATE TABLE IF NOT EXISTS session_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        event_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_session_events_session_id
        ON session_events(session_id, id ASC);
    `);
  }

  private upsertSqliteSession(session: TaskSession): void {
    this.db
      ?.prepare(
        `
        INSERT INTO sessions (
          id, project_id, title, status, provider_profile_id, artifact_ids, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          project_id = excluded.project_id,
          title = excluded.title,
          status = excluded.status,
          provider_profile_id = excluded.provider_profile_id,
          artifact_ids = excluded.artifact_ids,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `
      )
      .run(
        session.id,
        session.projectId,
        session.title,
        session.status,
        session.providerProfileId,
        JSON.stringify(session.artifactIds),
        session.createdAt,
        session.updatedAt
      );
  }

  private getSqliteSession(id: string): TaskSession | undefined {
    const row = this.db
      ?.prepare("SELECT * FROM sessions WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.sqliteRowToSession(row) : undefined;
  }

  private listSqliteSessions(projectId?: string): TaskSession[] {
    const rows = projectId
      ? (this.db
          ?.prepare("SELECT * FROM sessions WHERE project_id = ? ORDER BY updated_at DESC")
          .all(projectId) as Record<string, unknown>[] | undefined)
      : (this.db
          ?.prepare("SELECT * FROM sessions ORDER BY updated_at DESC")
          .all() as Record<string, unknown>[] | undefined);
    return (rows ?? []).map((row) => this.sqliteRowToSession(row));
  }

  private sqliteRowToSession(row: Record<string, unknown>): TaskSession {
    const id = String(row.id);
    return {
      id,
      projectId: String(row.project_id),
      title: String(row.title),
      status: row.status as TaskSession["status"],
      providerProfileId: String(row.provider_profile_id),
      artifactIds: JSON.parse(String(row.artifact_ids)) as string[],
      messages: this.listSqliteMessages(id),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    };
  }

  private insertSqliteMessage(sessionId: string, message: ConversationMessage): void {
    const row = this.db
      ?.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM session_messages WHERE session_id = ?")
      .get(sessionId) as { next_position: number } | undefined;
    this.db
      ?.prepare(
        `
        INSERT OR REPLACE INTO session_messages (
          id, session_id, role, content, created_at, position
        ) VALUES (?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        message.id,
        sessionId,
        message.role,
        message.content,
        message.createdAt,
        row?.next_position ?? 0
      );
  }

  private replaceSqliteMessages(sessionId: string, messages: ConversationMessage[]): void {
    this.db?.prepare("DELETE FROM session_messages WHERE session_id = ?").run(sessionId);
    messages.forEach((message, index) => {
      this.db
        ?.prepare(
          `
          INSERT INTO session_messages (
            id, session_id, role, content, created_at, position
          ) VALUES (?, ?, ?, ?, ?, ?)
        `
        )
        .run(message.id, sessionId, message.role, message.content, message.createdAt, index);
    });
  }

  private listSqliteMessages(sessionId: string): ConversationMessage[] {
    const rows = this.db
      ?.prepare(
        "SELECT id, role, content, created_at FROM session_messages WHERE session_id = ? ORDER BY position ASC"
      )
      .all(sessionId) as Record<string, unknown>[] | undefined;
    return (rows ?? []).map((row) => ({
      id: String(row.id),
      role: row.role as ConversationMessage["role"],
      content: String(row.content),
      createdAt: String(row.created_at)
    }));
  }

  private insertSqliteEvent(sessionId: string, event: AgentEvent): void {
    this.db
      ?.prepare("INSERT INTO session_events (session_id, event_json, created_at) VALUES (?, ?, ?)")
      .run(sessionId, JSON.stringify(event), new Date().toISOString());
  }

  private listSqliteEvents(sessionId: string): AgentEvent[] {
    const rows = this.db
      ?.prepare("SELECT event_json FROM session_events WHERE session_id = ? ORDER BY id ASC")
      .all(sessionId) as Array<{ event_json: string }> | undefined;
    return (rows ?? []).map((row) => JSON.parse(row.event_json) as AgentEvent);
  }
}
