import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderKanban, History, Layers, Settings, TerminalSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProjectsPage } from "@/features/projects/projects-page";
import { WorkspacePage } from "@/features/workspace/workspace-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { RunsPage } from "@/features/runs/runs-page";
import { ArtifactsPage } from "@/features/artifacts/artifacts-page";
import type { ArtifactViewModel } from "@/features/artifacts/artifact-types";
import {
  createApiClient,
  type ArtifactDto,
  type ArtifactPreviewDto,
  type ProjectDto,
  type TaskSessionDto
} from "@/lib/api-client";
import { routes, type AppRoute } from "./routes";

const icons: Record<AppRoute, typeof TerminalSquare> = {
  workspace: TerminalSquare,
  projects: FolderKanban,
  runs: History,
  artifacts: Layers,
  settings: Settings
};

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  return [item, ...items.filter((existing) => existing.id !== item.id)];
}

function artifactToView(
  artifact: ArtifactDto,
  preview?: ArtifactPreviewDto
): ArtifactViewModel {
  const content =
    preview?.content ??
    (preview?.json ? JSON.stringify(preview.json, null, 2) : undefined);
  return {
    id: artifact.id,
    kind: artifact.kind,
    title: artifact.title,
    mimeType: artifact.mimeType,
    downloadUrl: `/api/artifacts/${artifact.id}`,
    content,
    rows: preview?.rows,
    sizeBytes: preview?.sizeBytes ?? artifact.sizeBytes
  };
}

export function App({ route = "workspace" }: { route?: AppRoute }) {
  const api = useMemo(() => createApiClient(), []);
  const [activeRoute, setActiveRoute] = useState<AppRoute>(route);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>();
  const [sessions, setSessions] = useState<TaskSessionDto[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>();
  const [artifacts, setArtifacts] = useState<ArtifactDto[]>([]);
  const [artifactPreviews, setArtifactPreviews] = useState<Record<string, ArtifactPreviewDto>>({});
  const [selectedArtifactId, setSelectedArtifactId] = useState<string>();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string>();

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const artifactViews = artifacts.map((artifact) =>
    artifactToView(artifact, artifactPreviews[artifact.id])
  );

  const refreshArtifacts = useCallback(async (sessionId: string) => {
    const items = await api.listArtifacts({ sessionId });
    setArtifacts(items);
    setSelectedArtifactId((current) =>
      items.some((artifact) => artifact.id === current) ? current : items[0]?.id
    );
    const previews = await Promise.all(
      items.map(async (artifact) => [artifact.id, await api.getArtifactPreview(artifact.id)] as const)
    );
    setArtifactPreviews((current) => ({ ...current, ...Object.fromEntries(previews) }));
  }, [api]);

  useEffect(() => {
    api
      .listProjects()
      .then((items) => {
        setProjects(items);
        setSelectedProjectId((current) => current ?? items[0]?.id);
      })
      .catch((caught) => setError((caught as Error).message));
  }, [api]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    api
      .listSessions(selectedProjectId)
      .then((items) => {
        const nextSessionId = items[0]?.id;
        setSessions(items);
        if (items.length === 0) {
          setArtifacts([]);
        }
        setActiveSessionId(nextSessionId);
        if (nextSessionId) {
          return refreshArtifacts(nextSessionId);
        }
        return undefined;
      })
      .catch((caught) => setError((caught as Error).message));
  }, [api, selectedProjectId, refreshArtifacts]);

  const refreshSession = useCallback(async (sessionId: string) => {
    const session = await api.getSession(sessionId);
    setSessions((items) => upsertById(items, session));
    setActiveSessionId(session.id);
    await refreshArtifacts(session.id);
  }, [api, refreshArtifacts]);

  async function createProject(input: { name: string; workspacePath: string }) {
    const project = await api.createProject(input);
    setProjects((items) => upsertById(items, project));
    setSelectedProjectId(project.id);
    setActiveRoute("workspace");
  }

  async function runTask(prompt: string) {
    if (!selectedProject) {
      setError("Create or select a project first.");
      return;
    }

    setIsRunning(true);
    setError(undefined);
    try {
      const session = await api.createSession({
        projectId: selectedProject.id,
        title: prompt.slice(0, 48) || "Local run"
      });
      setSessions((items) => upsertById(items, session));
      setActiveSessionId(session.id);
      await api.sendMessage(session.id, prompt);
      await refreshSession(session.id);
      setActiveRoute("workspace");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setIsRunning(false);
    }
  }

  function routeContent() {
    if (activeRoute === "projects") {
      return (
        <ProjectsPage
          projects={projects}
          selectedProjectId={selectedProjectId}
          onCreateProject={createProject}
          onSelectProject={(projectId) => {
            setSelectedProjectId(projectId);
            setActiveRoute("workspace");
          }}
        />
      );
    }
    if (activeRoute === "runs") return <RunsPage />;
    if (activeRoute === "artifacts") {
      return (
        <ArtifactsPage
          artifacts={artifactViews}
          selectedArtifactId={selectedArtifactId}
          onSelectArtifact={setSelectedArtifactId}
        />
      );
    }
    if (activeRoute === "settings") return <SettingsPage />;
    return (
      <WorkspacePage
        projects={projects}
        selectedProject={selectedProject}
        sessions={sessions}
        activeSession={activeSession}
        artifacts={artifactViews}
        isRunning={isRunning}
        error={error}
        onSelectProject={setSelectedProjectId}
        onSelectSession={refreshSession}
        onRun={runTask}
        onSelectArtifact={(artifactId) => {
          setSelectedArtifactId(artifactId);
          setActiveRoute("artifacts");
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <h1 className="text-lg font-semibold">Harness Agent</h1>
          <nav className="flex flex-wrap gap-1">
            {routes.map((item) => {
              const Icon = icons[item.id];
              return (
                <Button
                  key={item.id}
                  variant={item.id === activeRoute ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setActiveRoute(item.id)}
                >
                  <Icon data-icon="inline-start" />
                  {item.label}
                </Button>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-4">{routeContent()}</main>
    </div>
  );
}
