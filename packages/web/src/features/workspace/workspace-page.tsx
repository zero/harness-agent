import { useState } from "react";
import { Play, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ArtifactCard } from "@/features/artifacts/artifact-card";
import type { ArtifactViewModel } from "@/features/artifacts/artifact-types";
import { MarkdownRenderer } from "@/features/markdown/markdown-renderer";
import type { ProjectDto, TaskSessionDto } from "@/lib/api-client";

export interface WorkspacePageProps {
  projects?: ProjectDto[];
  selectedProject?: ProjectDto;
  sessions?: TaskSessionDto[];
  activeSession?: TaskSessionDto;
  artifacts?: ArtifactViewModel[];
  isRunning?: boolean;
  error?: string;
  onSelectProject?: (projectId: string) => void;
  onSelectSession?: (sessionId: string) => void;
  onRun?: (prompt: string) => void | Promise<void>;
  onSelectArtifact?: (artifactId: string) => void;
}

export function WorkspacePage({
  projects = [],
  selectedProject,
  sessions = [],
  activeSession,
  artifacts = [],
  isRunning = false,
  error,
  onSelectProject,
  onSelectSession,
  onRun,
  onSelectArtifact
}: WorkspacePageProps) {
  const [prompt, setPrompt] = useState("");

  async function runTask() {
    if (!prompt.trim()) {
      return;
    }
    await onRun?.(prompt.trim());
    setPrompt("");
  }

  return (
    <section className="grid min-h-[calc(100vh-8rem)] gap-4 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
      <aside className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Session history</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet</p>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              className="rounded-md border bg-card p-3 text-left text-sm hover:bg-muted"
              onClick={() => onSelectSession?.(session.id)}
            >
              <span className="block font-medium">{session.title}</span>
              <span className="text-xs text-muted-foreground">{session.status}</span>
            </button>
          ))
        )}
      </aside>
      <main className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Ask the local agent</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {projects.map((project) => (
                <Button
                  key={project.id}
                  variant={project.id === selectedProject?.id ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => onSelectProject?.(project.id)}
                >
                  {project.name}
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedProject
                ? `Workspace: ${selectedProject.workspacePath}`
                : "Create or select a project before running local tasks."}
            </p>
            <Textarea
              placeholder="Ask for a local task"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end">
              <Button disabled={!selectedProject || isRunning} onClick={runTask}>
                <Play data-icon="inline-start" />
                {isRunning ? "Running" : "Run"}
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            {(activeSession?.messages ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Conversation output, tool calls, and generated artifacts will appear here.
              </p>
            ) : (
              activeSession?.messages.map((message) => (
                <article key={message.id} className="rounded-md bg-muted p-3 text-sm">
                  <h3 className="font-semibold capitalize">{message.role}</h3>
                  {message.role === "assistant" ? (
                    <MarkdownRenderer content={message.content} />
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </article>
              ))
            )}
            <details className="rounded-md border p-3 text-sm" open>
              <summary className="flex items-center gap-2 font-medium">
                <Terminal data-icon="inline-start" />
                Runtime state
              </summary>
              <pre className="mt-2 overflow-auto text-xs">
                {JSON.stringify(
                  {
                    session: activeSession?.id ?? null,
                    status: activeSession?.status ?? "idle",
                    artifacts: artifacts.length
                  },
                  null,
                  2
                )}
              </pre>
            </details>
            {artifacts.slice(0, 2).map((artifact) => (
              <ArtifactCard key={artifact.id} artifact={artifact} onPreview={onSelectArtifact} />
            ))}
          </CardContent>
        </Card>
      </main>
      <aside>
        <Tabs defaultValue="artifacts">
          <TabsList>
            <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>
          <TabsContent value="artifacts" className="mt-3">
            <div className="flex flex-col gap-2">
              {artifacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No artifacts yet</p>
              ) : (
                artifacts.map((artifact) => (
                  <button
                    key={artifact.id}
                    className="rounded-md border bg-card p-3 text-left text-sm hover:bg-muted"
                    onClick={() => onSelectArtifact?.(artifact.id)}
                  >
                    <span className="block truncate font-medium">{artifact.title}</span>
                    <span className="text-xs text-muted-foreground">{artifact.kind}</span>
                  </button>
                ))
              )}
            </div>
          </TabsContent>
          <TabsContent value="files" className="mt-3">
            <Card>
              <CardContent className="p-3 text-sm">
                {selectedProject?.workspacePath ?? "No project selected"}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="events" className="mt-3">
            <Card>
              <CardContent className="p-3 text-sm">
                {activeSession ? `session.${activeSession.status}` : "session.idle"}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </aside>
    </section>
  );
}
