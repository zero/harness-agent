import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  resolveProjectPath,
  type AgentEvent,
  type Artifact,
  type GlobalSettings,
  type Project
} from "@harness-agent/core";
import { Hono } from "hono";

import { createDefaultSettings } from "./config/default-settings";
import { SessionStore } from "./sessions/session-store";
import { JsonFileStore } from "./storage/json-store";

export interface RuntimeLike {
  runTask(request: unknown): AsyncIterable<AgentEvent>;
}

export interface CreateServerAppOptions {
  dataDir: string;
  runtime?: RuntimeLike;
  initialProjects?: Project[];
  initialArtifacts?: Artifact[];
}

function now(): string {
  return new Date().toISOString();
}

function createProject(input: { name: string; workspacePath: string }): Project {
  const timestamp = now();
  return {
    id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    workspacePath: input.workspacePath,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function sse(events: AgentEvent[]): Response {
  return new Response(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
    {
      headers: {
        "content-type": "text/event-stream"
      }
    }
  );
}

function createDefaultRuntime(): RuntimeLike {
  return {
    async *runTask(request: { sessionId: string; messageId: string }): AsyncIterable<AgentEvent> {
      yield { type: "session.started", sessionId: request.sessionId };
      yield {
        type: "message.delta",
        messageId: request.messageId,
        text: "Local runtime is ready."
      };
      yield { type: "message.completed", messageId: request.messageId };
      yield { type: "session.completed", sessionId: request.sessionId };
    }
  };
}

function previewArtifact(artifact: Artifact, content: string): Record<string, unknown> {
  if (artifact.kind === "json") {
    return { kind: artifact.kind, json: JSON.parse(content) };
  }

  if (
    artifact.kind === "markdown" ||
    artifact.kind === "html" ||
    artifact.kind === "csv" ||
    artifact.kind === "text"
  ) {
    return { kind: artifact.kind, content };
  }

  return {
    kind: artifact.kind,
    title: artifact.title,
    mimeType: artifact.mimeType,
    sizeBytes: artifact.sizeBytes
  };
}

export function createServerApp(options: CreateServerAppOptions): Hono {
  const app = new Hono();
  const projectsStore = new JsonFileStore<Project[]>(
    join(options.dataDir, "projects.json"),
    options.initialProjects ?? []
  );
  const settingsStore = new JsonFileStore<GlobalSettings>(
    join(options.dataDir, "settings.json"),
    createDefaultSettings()
  );
  const artifactStore = new JsonFileStore<Artifact[]>(
    join(options.dataDir, "artifacts.json"),
    options.initialArtifacts ?? []
  );
  const sessions = new SessionStore();
  const runtime = options.runtime ?? createDefaultRuntime();

  app.get("/api/health", (context) => context.json({ ok: true }));

  app.get("/api/projects", (context) => context.json(projectsStore.get()));
  app.post("/api/projects", async (context) => {
    const body = (await context.req.json()) as { name: string; workspacePath: string };
    const project = createProject(body);
    projectsStore.set([...projectsStore.get(), project]);
    return context.json(project);
  });
  app.patch("/api/projects/:projectId", async (context) => {
    const projectId = context.req.param("projectId");
    const body = (await context.req.json()) as Partial<Project>;
    const projects = projectsStore.get();
    const project = projects.find((item) => item.id === projectId);
    if (!project) {
      return context.json({ error: "Project not found" }, 404);
    }
    const updated = { ...project, ...body, id: project.id, updatedAt: now() };
    projectsStore.set(projects.map((item) => (item.id === projectId ? updated : item)));
    return context.json(updated);
  });
  app.delete("/api/projects/:projectId", (context) => {
    const projectId = context.req.param("projectId");
    projectsStore.set(projectsStore.get().filter((project) => project.id !== projectId));
    return context.body(null, 204);
  });

  app.get("/api/settings", (context) => context.json(settingsStore.get()));
  app.put("/api/settings", async (context) => {
    const body = (await context.req.json()) as GlobalSettings;
    settingsStore.set(body);
    return context.json(body);
  });
  app.post("/api/providers/test", (context) => context.json({ ok: true }));
  app.post("/api/mcp/test", (context) => context.json({ ok: true }));

  app.get("/api/sessions", (context) => {
    const projectId = context.req.query("projectId");
    return context.json(sessions.list(projectId));
  });
  app.post("/api/sessions", async (context) => {
    const body = (await context.req.json()) as {
      projectId: string;
      title: string;
      providerProfileId?: string;
    };
    const settings = settingsStore.get();
    const providerProfileId = body.providerProfileId ?? settings.providerProfiles[0]?.id ?? "local";
    return context.json(
      sessions.create({
        projectId: body.projectId,
        title: body.title,
        providerProfileId
      })
    );
  });
  app.get("/api/sessions/:sessionId", (context) => {
    const session = sessions.get(context.req.param("sessionId"));
    return session ? context.json(session) : context.json({ error: "Session not found" }, 404);
  });
  app.post("/api/sessions/:sessionId/messages", async (context) => {
    const sessionId = context.req.param("sessionId");
    const session = sessions.get(sessionId);
    if (!session) {
      return context.json({ error: "Session not found" }, 404);
    }
    const project = projectsStore.get().find((item) => item.id === session.projectId);
    if (!project) {
      return context.json({ error: "Project not found" }, 404);
    }
    const body = (await context.req.json()) as { content: string };
    const messageId = `message-${Date.now()}`;
    sessions.appendMessage(sessionId, {
      id: messageId,
      role: "user",
      content: body.content,
      createdAt: now()
    });
    sessions.update(sessionId, { status: "running" });

    for await (const event of runtime.runTask({ sessionId, messageId, project })) {
      sessions.appendEvent(sessionId, event);
    }
    sessions.update(sessionId, { status: "completed" });
    return context.json({ ok: true, events: sessions.events(sessionId).length });
  });
  app.post("/api/sessions/:sessionId/cancel", (context) => {
    const sessionId = context.req.param("sessionId");
    sessions.update(sessionId, { status: "cancelled" });
    return context.json({ ok: true });
  });
  app.get("/api/sessions/:sessionId/events", (context) =>
    sse(sessions.events(context.req.param("sessionId")))
  );

  app.get("/api/artifacts/:artifactId", (context) => {
    const artifact = artifactStore.get().find((item) => item.id === context.req.param("artifactId"));
    if (!artifact) {
      return context.json({ error: "Artifact not found" }, 404);
    }
    const project = projectsStore.get().find((item) => item.id === artifact.projectId);
    if (!project) {
      return context.json({ error: "Project not found" }, 404);
    }

    try {
      const path = resolveProjectPath(project, artifact.relativePath);
      if (!existsSync(path)) {
        return context.json({ error: "Artifact file not found" }, 404);
      }
      return context.text(readFileSync(path, "utf8"), 200, {
        "content-type": artifact.mimeType
      });
    } catch (error) {
      return context.json({ error: (error as Error).message }, 400);
    }
  });
  app.get("/api/artifacts/:artifactId/preview", (context) => {
    const artifact = artifactStore.get().find((item) => item.id === context.req.param("artifactId"));
    if (!artifact) {
      return context.json({ error: "Artifact not found" }, 404);
    }
    const project = projectsStore.get().find((item) => item.id === artifact.projectId);
    if (!project) {
      return context.json({ error: "Project not found" }, 404);
    }

    try {
      const path = resolveProjectPath(project, artifact.relativePath);
      if (!existsSync(path)) {
        return context.json({ error: "Artifact file not found" }, 404);
      }
      return context.json(previewArtifact(artifact, readFileSync(path, "utf8")));
    } catch (error) {
      return context.json({ error: (error as Error).message }, 400);
    }
  });

  return app;
}
