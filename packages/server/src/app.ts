import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  resolveProjectPath,
  type AgentEvent,
  type Artifact,
  type GlobalSettings,
  type Project
} from "@harness-agent/core";
import { writeArtifact } from "@harness-agent/tools";
import { Hono } from "hono";

import { createDefaultSettings } from "./config/default-settings";
import { SessionStore } from "./sessions/session-store";
import { JsonFileStore } from "./storage/json-store";

export interface RuntimeTaskRequest {
  sessionId: string;
  messageId: string;
  project: Project;
  content: string;
  providerProfileId: string;
}

export interface RuntimeLike {
  runTask(request: RuntimeTaskRequest): AsyncIterable<AgentEvent>;
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
    async *runTask(request: RuntimeTaskRequest): AsyncIterable<AgentEvent> {
      yield { type: "session.started", sessionId: request.sessionId };
      yield {
        type: "message.delta",
        messageId: request.messageId,
        text: "Running a local harness task inside the selected project. "
      };

      const commonContent = [
        `Prompt: ${request.content}`,
        "",
        "This local runtime demonstrates workspace-bounded artifact generation without requiring an API key."
      ].join("\n");
      const artifactInputs: Omit<Parameters<typeof writeArtifact>[0], "project">[] = [
        {
          sessionId: request.sessionId,
          kind: "markdown",
          title: "Local Task Summary",
          content: commonContent
        },
        {
          sessionId: request.sessionId,
          kind: "html",
          title: "Local Task Preview",
          content: `<h1>Local Task Preview</h1><p>${request.content}</p>`
        },
        {
          sessionId: request.sessionId,
          kind: "csv",
          title: "Local Task Data",
          rows: [
            { metric: "provider", value: request.providerProfileId },
            { metric: "workspace", value: request.project.workspacePath },
            { metric: "prompt", value: request.content }
          ]
        },
        {
          sessionId: request.sessionId,
          kind: "xlsx",
          title: "Local Task Workbook",
          rows: [
            { step: "plan", status: "done" },
            { step: "artifact generation", status: "done" },
            { step: "preview wiring", status: "done" }
          ]
        },
        {
          sessionId: request.sessionId,
          kind: "docx",
          title: "Local Task Document",
          content: commonContent
        },
        {
          sessionId: request.sessionId,
          kind: "pptx",
          title: "Local Task Deck",
          content: commonContent
        },
        {
          sessionId: request.sessionId,
          kind: "pdf",
          title: "Local Task Brief",
          content: commonContent
        }
      ];

      for (const artifactInput of artifactInputs) {
        const callId = `artifact-${artifactInput.kind}`;
        yield {
          type: "tool.call",
          callId,
          toolName: "artifact.write",
          input: artifactInput
        };
        const artifact = await writeArtifact({
          ...artifactInput,
          project: request.project
        });
        yield {
          type: "tool.result",
          callId,
          toolName: "artifact.write",
          output: artifact
        };
        yield { type: "artifact.created", artifact };
      }

      yield {
        type: "message.delta",
        messageId: request.messageId,
        text: "Generated local artifacts: markdown, html, csv, xlsx, docx, pptx, and pdf."
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

  if (artifact.kind === "csv") {
    return { kind: artifact.kind, content, rows: parseCsvRows(content) };
  }

  if (
    artifact.kind === "markdown" ||
    artifact.kind === "html" ||
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

function parseCsvRows(content: string): Record<string, string>[] {
  const [headerLine, ...lines] = content.trim().split(/\r?\n/);
  if (!headerLine) {
    return [];
  }
  const headers = headerLine.split(",");

  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function isTextArtifact(kind: Artifact["kind"]): boolean {
  return kind === "markdown" || kind === "html" || kind === "csv" || kind === "json" || kind === "text";
}

function upsertArtifact(artifacts: Artifact[], artifact: Artifact): Artifact[] {
  return [...artifacts.filter((item) => item.id !== artifact.id), artifact];
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

  app.get("/api/artifacts", (context) => {
    const projectId = context.req.query("projectId");
    const sessionId = context.req.query("sessionId");
    return context.json(
      artifactStore
        .get()
        .filter((artifact) => !projectId || artifact.projectId === projectId)
        .filter((artifact) => !sessionId || artifact.sessionId === sessionId)
    );
  });

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

    let assistantContent = "";
    for await (const event of runtime.runTask({
      sessionId,
      messageId,
      project,
      content: body.content,
      providerProfileId: session.providerProfileId
    })) {
      sessions.appendEvent(sessionId, event);
      if (event.type === "message.delta") {
        assistantContent += event.text;
      }
      if (event.type === "artifact.created") {
        artifactStore.set(upsertArtifact(artifactStore.get(), event.artifact));
        const latestSession = sessions.get(sessionId);
        sessions.update(sessionId, {
          artifactIds: [...new Set([...(latestSession?.artifactIds ?? []), event.artifact.id])]
        });
      }
    }
    if (assistantContent) {
      sessions.appendMessage(sessionId, {
        id: `${messageId}-assistant`,
        role: "assistant",
        content: assistantContent,
        createdAt: now()
      });
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
      const headers = {
        "content-type": artifact.mimeType,
        "content-length": String(statSync(path).size)
      };
      if (isTextArtifact(artifact.kind)) {
        return context.text(readFileSync(path, "utf8"), 200, headers);
      }

      return new Response(readFileSync(path), {
        status: 200,
        headers
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
      const content = isTextArtifact(artifact.kind) ? readFileSync(path, "utf8") : "";
      return context.json(previewArtifact(artifact, content));
    } catch (error) {
      return context.json({ error: (error as Error).message }, 400);
    }
  });

  return app;
}
