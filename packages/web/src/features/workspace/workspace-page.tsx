import { type KeyboardEvent, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Clock3,
  FileText,
  FolderKanban,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Terminal,
  User
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ArtifactCard } from "@/features/artifacts/artifact-card";
import type { ArtifactViewModel } from "@/features/artifacts/artifact-types";
import { MarkdownRenderer } from "@/features/markdown/markdown-renderer";
import type {
  AgentEventDto,
  ProjectDto,
  ProviderProfileDto,
  TaskSessionDto
} from "@/lib/api-client";
import { cn } from "@/lib/utils";

export interface WorkspacePageProps {
  projects?: ProjectDto[];
  selectedProject?: ProjectDto;
  providerProfiles?: ProviderProfileDto[];
  selectedProviderProfileId?: string;
  sessions?: TaskSessionDto[];
  activeSession?: TaskSessionDto;
  events?: AgentEventDto[];
  artifacts?: ArtifactViewModel[];
  isRunning?: boolean;
  error?: string;
  onSelectProject?: (projectId: string) => void;
  onSelectProviderProfile?: (profileId: string) => void;
  onSelectSession?: (sessionId: string) => void;
  onNewChat?: () => void;
  onRun?: (prompt: string) => void | Promise<void>;
  onSelectArtifact?: (artifactId: string) => void;
}

const suggestedPrompts = [
  "梳理当前项目结构，并给出下一步实现建议",
  "检查 provider、tools、MCP、skills 是否可以完成闭环",
  "在 workspace 内生成一份 Markdown 任务计划"
];

const timeFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

function formatTime(value?: string) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return timeFormatter.format(date);
}

function statusLabel(session?: TaskSessionDto, isRunning = false) {
  if (isRunning) {
    return "running";
  }
  return session?.status ?? "idle";
}

function statusTone(status: string) {
  if (status === "running") {
    return "bg-primary text-primary-foreground";
  }
  if (status === "completed") {
    return "bg-accent text-accent-foreground";
  }
  if (status === "failed") {
    return "bg-background text-foreground";
  }
  return "bg-muted text-muted-foreground";
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border bg-background p-3">
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <span className="truncate text-sm">{value}</span>
    </div>
  );
}

function processEventTitle(event: AgentEventDto): string {
  if (event.type === "thinking") {
    return `Thinking: ${event.summary}`;
  }
  if (event.type === "skill.match") {
    return `Matched skill ${event.skillName}`;
  }
  if (event.type === "tool.call") {
    return `Calling ${event.toolName}`;
  }
  if (event.type === "tool.result") {
    return `Completed ${event.toolName}`;
  }
  if (event.type === "artifact.created") {
    return `Created ${event.artifact.title}`;
  }
  if (event.type === "session.started") {
    return "Session started";
  }
  if (event.type === "session.completed") {
    return "Session completed";
  }
  if (event.type === "message.completed") {
    return "Assistant response completed";
  }
  if (event.type === "error") {
    return event.message;
  }
  return "Assistant is writing";
}

function processEventDetail(event: AgentEventDto): string {
  if (event.type === "thinking") {
    return "Working out the next visible step";
  }
  if (event.type === "skill.match") {
    return event.reason;
  }
  if (event.type === "tool.call") {
    return JSON.stringify(event.input);
  }
  if (event.type === "tool.result") {
    return JSON.stringify(event.output);
  }
  if (event.type === "artifact.created") {
    return event.artifact.kind;
  }
  if (event.type === "error") {
    return event.recoverable ? "Recoverable" : "Stopped";
  }
  return "";
}

function isVisibleProcessEvent(event: AgentEventDto): boolean {
  return event.type !== "message.delta";
}

function isMessageProcessEvent(event: AgentEventDto): boolean {
  return event.type !== "message.delta" && event.type !== "message.completed";
}

function buildAssistantProcessGroups(events: AgentEventDto[]): AgentEventDto[][] {
  const groups: AgentEventDto[][] = [];
  let currentGroup: AgentEventDto[] = [];

  for (const event of events) {
    if (event.type === "message.delta" || event.type === "message.completed") {
      continue;
    }

    if (event.type === "session.started" && currentGroup.length > 0) {
      groups.push(currentGroup);
      currentGroup = [];
    }

    if (isMessageProcessEvent(event)) {
      currentGroup.push(event);
    }

    if (event.type === "session.completed" && currentGroup.length > 0) {
      groups.push(currentGroup);
      currentGroup = [];
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

function processEventDetailJson(event: AgentEventDto): string {
  if (event.type === "thinking") {
    return JSON.stringify({ summary: event.summary }, null, 2);
  }
  if (event.type === "skill.match") {
    return JSON.stringify(
      {
        skillName: event.skillName,
        path: event.path,
        reason: event.reason
      },
      null,
      2
    );
  }
  if (event.type === "tool.call") {
    return JSON.stringify(event.input, null, 2);
  }
  if (event.type === "tool.result") {
    return JSON.stringify(event.output, null, 2);
  }
  if (event.type === "artifact.created") {
    return JSON.stringify(event.artifact, null, 2);
  }
  if (event.type === "error") {
    return JSON.stringify(
      {
        message: event.message,
        recoverable: event.recoverable
      },
      null,
      2
    );
  }
  return JSON.stringify(event, null, 2);
}

function MessageProcessDetails({ events }: { events: AgentEventDto[] }) {
  if (events.length === 0) {
    return null;
  }

  return (
    <details className="rounded-md border bg-background">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-xs font-medium text-muted-foreground">
        <span>Agent process</span>
        <span>{events.length} process events</span>
      </summary>
      <div className="flex flex-col gap-2 border-t px-3 py-2">
        {events.map((event, index) => {
          const title = processEventTitle(event);
          return (
            <details key={`${event.type}-${index}`} className="rounded-md border bg-card">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium">
                {title}
              </summary>
              <pre
                aria-label={`Process detail for ${title}`}
                className="max-h-56 overflow-auto border-t p-3 text-xs leading-5 text-muted-foreground"
              >
                {processEventDetailJson(event)}
              </pre>
            </details>
          );
        })}
      </div>
    </details>
  );
}

export function WorkspacePage({
  projects = [],
  selectedProject,
  providerProfiles = [],
  selectedProviderProfileId,
  sessions = [],
  activeSession,
  events = [],
  artifacts = [],
  isRunning = false,
  error,
  onSelectProject,
  onSelectProviderProfile,
  onSelectSession,
  onNewChat,
  onRun,
  onSelectArtifact
}: WorkspacePageProps) {
  const [prompt, setPrompt] = useState("");
  const messages = activeSession?.messages ?? [];
  const selectedProvider = providerProfiles.find(
    (profile) => profile.id === selectedProviderProfileId
  );
  const currentStatus = statusLabel(activeSession, isRunning);
  const canSend = Boolean(selectedProject && prompt.trim() && !isRunning);
  const processEvents = events.filter(isVisibleProcessEvent).slice(-8);
  const assistantProcessGroups = buildAssistantProcessGroups(events);
  let assistantMessageIndex = 0;

  async function runTask() {
    if (!canSend) {
      return;
    }
    await onRun?.(prompt.trim());
    setPrompt("");
  }

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void runTask();
    }
  }

  return (
    <section className="flex h-[calc(100vh-3.5rem)] min-h-[640px] overflow-hidden bg-background md:h-screen">
      <aside className="hidden w-72 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
          <div className="flex min-w-0 items-center gap-2">
            <FolderKanban data-icon="inline-start" />
            <span className="truncate text-sm font-semibold">Projects</span>
          </div>
          <Button variant="ghost" size="icon" title="New chat" aria-label="New chat" onClick={onNewChat}>
            <Plus />
          </Button>
        </div>
        <div className="flex flex-col gap-2 border-b p-3">
          {projects.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">No projects</p>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                className={cn(
                  "flex min-h-12 flex-col gap-1 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                  project.id === selectedProject?.id ? "bg-muted" : "bg-card"
                )}
                onClick={() => onSelectProject?.(project.id)}
              >
                <span className="truncate font-medium">{project.name}</span>
                <span className="truncate text-xs text-muted-foreground">{project.workspacePath}</span>
              </button>
            ))
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium uppercase text-muted-foreground">Runs</span>
            <span className="text-xs text-muted-foreground">{sessions.length}</span>
          </div>
          {sessions.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">No runs yet</p>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                className={cn(
                  "flex flex-col gap-1 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                  session.id === activeSession?.id ? "bg-muted" : "bg-card"
                )}
                onClick={() => onSelectSession?.(session.id)}
              >
                <span className="truncate font-medium">{session.title}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock3 data-icon="inline-start" />
                  {formatTime(session.updatedAt) || session.status}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background px-4">
          <div className="flex min-w-0 flex-col">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-sm font-semibold">{activeSession?.title ?? "New chat"}</h1>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-medium",
                  statusTone(currentStatus)
                )}
              >
                {currentStatus}
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {selectedProject?.workspacePath ?? "No workspace selected"}
            </p>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            {projects.length > 0 ? (
              <select
                aria-label="Project"
                className="hidden h-9 max-w-48 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary sm:block"
                value={selectedProject?.id ?? ""}
                onChange={(event) => onSelectProject?.(event.target.value)}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            ) : null}
            {providerProfiles.length > 0 ? (
              <select
                aria-label="Provider profile"
                className="hidden h-9 max-w-56 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary md:block"
                value={selectedProviderProfileId ?? providerProfiles[0]?.id ?? ""}
                onChange={(event) => onSelectProviderProfile?.(event.target.value)}
              >
                {providerProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} / {profile.model}
                  </option>
                ))}
              </select>
            ) : null}
            <Button variant="outline" size="sm" onClick={onNewChat}>
              <Plus data-icon="inline-start" />
              New
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
              <div className="mx-auto flex max-w-3xl flex-col gap-5">
                {messages.length === 0 ? (
                  <div className="flex min-h-[42vh] flex-col items-center justify-center gap-5 text-center">
                    <div className="flex size-12 items-center justify-center rounded-lg border bg-card">
                      <Sparkles />
                    </div>
                    <div className="flex flex-col gap-2">
                      <h2 className="text-2xl font-semibold">Ready when you are</h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedProject?.name ?? "Select a project"} ·{" "}
                        {selectedProvider?.name ?? "No provider selected"}
                      </p>
                    </div>
                    <div className="flex w-full max-w-xl flex-col gap-2">
                      {suggestedPrompts.map((suggestion) => (
                        <button
                          key={suggestion}
                          className="rounded-md border bg-card px-4 py-3 text-left text-sm transition-colors hover:bg-muted"
                          onClick={() => setPrompt(suggestion)}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isUser = message.role === "user";
                    const messageProcessEvents = isUser
                      ? []
                      : assistantProcessGroups[assistantMessageIndex++] ?? [];
                    return (
                      <article
                        key={message.id}
                        className={cn("flex", isUser ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "flex max-w-[min(720px,88%)] flex-col gap-2 rounded-lg px-4 py-3 text-sm",
                            isUser ? "bg-primary text-primary-foreground" : "border bg-card"
                          )}
                        >
                          <div
                            className={cn(
                              "flex items-center gap-2 text-xs font-medium",
                              isUser ? "text-primary-foreground" : "text-muted-foreground"
                            )}
                          >
                            {isUser ? <User data-icon="inline-start" /> : <Bot data-icon="inline-start" />}
                            <span>{isUser ? "You" : "Harness Agent"}</span>
                            <span>{formatTime(message.createdAt)}</span>
                          </div>
                          {message.role === "assistant" ? (
                            <MarkdownRenderer content={message.content} />
                          ) : (
                            <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                          )}
                          {message.role === "assistant" ? (
                            <MessageProcessDetails events={messageProcessEvents} />
                          ) : null}
                        </div>
                      </article>
                    );
                  })
                )}
                {isRunning ? (
                  <article className="flex justify-start" aria-label="Harness Agent thinking">
                    <div className="flex max-w-[min(720px,88%)] flex-col gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Bot data-icon="inline-start" />
                        <span>Harness Agent</span>
                        <Loader2 data-icon="inline-start" className="animate-spin" />
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {processEvents.at(-1)
                          ? processEventTitle(processEvents.at(-1)!)
                          : "Thinking"}
                      </div>
                      {processEvents.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {processEvents.map((event, index) => (
                            <div
                              key={`${event.type}-${index}`}
                              className="flex items-start gap-3 rounded-md bg-background px-3 py-2 text-sm"
                            >
                              <CheckCircle2 data-icon="inline-start" />
                              <div className="min-w-0">
                                <p className="font-medium">{processEventTitle(event)}</p>
                                {processEventDetail(event) ? (
                                  <p className="truncate text-xs text-muted-foreground">
                                    {processEventDetail(event)}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                ) : null}
                {artifacts.length > 0 ? (
                  <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileText data-icon="inline-start" />
                      Generated artifacts
                    </div>
                    <div className="flex flex-col gap-2">
                      {artifacts.slice(0, 2).map((artifact) => (
                        <ArtifactCard key={artifact.id} artifact={artifact} onPreview={onSelectArtifact} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <form
              className="shrink-0 border-t bg-background px-4 py-4"
              onSubmit={(event) => {
                event.preventDefault();
                void runTask();
              }}
            >
              <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-lg border bg-card p-3 shadow-sm">
                <Textarea
                  placeholder="Message Harness Agent..."
                  className="min-h-24 resize-none border-0 bg-card px-1 py-1 focus:ring-0"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={handlePromptKeyDown}
                />
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                    <Terminal data-icon="inline-start" />
                    <span className="truncate">
                      {selectedProject?.name ?? "No project"} ·{" "}
                      {selectedProvider?.model ?? "No provider"}
                    </span>
                  </div>
                  <Button disabled={!canSend} type="submit">
                    <Send data-icon="inline-start" />
                    Send
                  </Button>
                </div>
              </div>
            </form>
          </main>

          <aside className="hidden w-80 shrink-0 overflow-y-auto border-l bg-card p-4 xl:block">
            <Tabs defaultValue="context" className="flex flex-col gap-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="context">Context</TabsTrigger>
                <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
              </TabsList>
              <TabsContent value="context" className="flex flex-col gap-3">
                <DetailRow label="Project" value={selectedProject?.name ?? "None"} />
                <DetailRow label="Workspace" value={selectedProject?.workspacePath ?? "None"} />
                <DetailRow
                  label="Provider"
                  value={
                    selectedProvider
                      ? `${selectedProvider.name} / ${selectedProvider.model}`
                      : "None"
                  }
                />
                <DetailRow label="Session" value={activeSession?.id ?? "New"} />
              </TabsContent>
              <TabsContent value="artifacts" className="flex flex-col gap-2">
                {artifacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No artifacts yet</p>
                ) : (
                  artifacts.map((artifact) => (
                    <button
                      key={artifact.id}
                      className="flex flex-col gap-1 rounded-md border bg-background p-3 text-left text-sm transition-colors hover:bg-muted"
                      onClick={() => onSelectArtifact?.(artifact.id)}
                    >
                      <span className="truncate font-medium">{artifact.title}</span>
                      <span className="text-xs text-muted-foreground">{artifact.kind}</span>
                    </button>
                  ))
                )}
              </TabsContent>
              <TabsContent value="events" className="flex flex-col gap-2">
                {processEvents.length === 0 ? (
                  <>
                    <div className="flex items-center gap-2 rounded-md border bg-background p-3 text-sm">
                      <CheckCircle2 data-icon="inline-start" />
                      session.{currentStatus}
                    </div>
                    <div className="flex items-center gap-2 rounded-md border bg-background p-3 text-sm">
                      <MessageSquare data-icon="inline-start" />
                      messages.{messages.length}
                    </div>
                    <div className="flex items-center gap-2 rounded-md border bg-background p-3 text-sm">
                      <FileText data-icon="inline-start" />
                      artifacts.{artifacts.length}
                    </div>
                  </>
                ) : (
                  processEvents.map((event, index) => (
                    <div
                      key={`${event.type}-${index}`}
                      className="flex flex-col gap-1 rounded-md border bg-background p-3 text-sm"
                    >
                      <span className="font-medium">{processEventTitle(event)}</span>
                      {processEventDetail(event) ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {processEventDetail(event)}
                        </span>
                      ) : null}
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </aside>
        </div>
      </div>
    </section>
  );
}
