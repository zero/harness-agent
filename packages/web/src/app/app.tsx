import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderKanban, History, Layers, Settings, TerminalSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProjectsPage } from "@/features/projects/projects-page";
import { WorkspacePage } from "@/features/workspace/workspace-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { RunsPage } from "@/features/runs/runs-page";
import { ArtifactsPage } from "@/features/artifacts/artifacts-page";
import type { ArtifactViewModel } from "@/features/artifacts/artifact-types";
import { upsertOptimisticUserMessage } from "./conversation-state";
import {
  createApiClient,
  type ArtifactDto,
  type ArtifactPreviewDto,
  type AgentEventDto,
  type ConversationMessageDto,
  type GlobalSettingsDto,
  type McpTestResultDto,
  type ProjectDto,
  type ProviderProfileDto,
  type ProviderTestResultDto,
  type SkillLoadResultDto,
  type TaskSessionDto,
  type ToolDefinitionDto
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
  const [sessionEvents, setSessionEvents] = useState<Record<string, AgentEventDto[]>>({});
  const [artifacts, setArtifacts] = useState<ArtifactDto[]>([]);
  const [artifactPreviews, setArtifactPreviews] = useState<Record<string, ArtifactPreviewDto>>({});
  const [selectedArtifactId, setSelectedArtifactId] = useState<string>();
  const [settings, setSettings] = useState<GlobalSettingsDto>();
  const [tools, setTools] = useState<ToolDefinitionDto[]>([]);
  const [mcpTools, setMcpTools] = useState<ToolDefinitionDto[]>([]);
  const [skills, setSkills] = useState<SkillLoadResultDto>({ skills: [], errors: [] });
  const [providerTest, setProviderTest] = useState<ProviderTestResultDto>();
  const [mcpTest, setMcpTest] = useState<McpTestResultDto>();
  const [selectedProviderProfileId, setSelectedProviderProfileId] = useState<string>();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string>();

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const activeEvents = activeSessionId ? sessionEvents[activeSessionId] ?? [] : [];
  const artifactViews = artifacts.map((artifact) =>
    artifactToView(artifact, artifactPreviews[artifact.id])
  );

  const refreshIntegrations = useCallback(async () => {
    const [nextSettings, nextTools, nextMcpTools, nextSkills] = await Promise.all([
      api.getSettings(),
      api.listTools(),
      api.listMcpTools(),
      api.listSkills()
    ]);
    setSettings(nextSettings);
    setTools(nextTools);
    setMcpTools(nextMcpTools);
    setSkills(nextSkills);
    setSelectedProviderProfileId((current) =>
      nextSettings.providerProfiles.some((profile) => profile.id === current)
        ? current
        : nextSettings.providerProfiles[0]?.id
    );
  }, [api]);

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

  const refreshSessionEvents = useCallback(async (sessionId: string) => {
    const events = await api.listSessionEvents(sessionId);
    setSessionEvents((current) => ({ ...current, [sessionId]: events }));
    return events;
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
    let disposed = false;
    Promise.all([api.getSettings(), api.listTools(), api.listMcpTools(), api.listSkills()])
      .then(([nextSettings, nextTools, nextMcpTools, nextSkills]) => {
        if (disposed) {
          return;
        }
        setSettings(nextSettings);
        setTools(nextTools);
        setMcpTools(nextMcpTools);
        setSkills(nextSkills);
        setSelectedProviderProfileId((current) =>
          nextSettings.providerProfiles.some((profile) => profile.id === current)
            ? current
            : nextSettings.providerProfiles[0]?.id
        );
      })
      .catch((caught) => {
        if (!disposed) {
          setError((caught as Error).message);
        }
      });
    return () => {
      disposed = true;
    };
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
          return Promise.all([refreshArtifacts(nextSessionId), refreshSessionEvents(nextSessionId)]);
        }
        return undefined;
      })
      .catch((caught) => setError((caught as Error).message));
  }, [api, selectedProjectId, refreshArtifacts, refreshSessionEvents]);

  const refreshSession = useCallback(async (sessionId: string) => {
    const session = await api.getSession(sessionId);
    setSessions((items) => upsertById(items, session));
    setActiveSessionId(session.id);
    await Promise.all([refreshArtifacts(session.id), refreshSessionEvents(session.id)]);
  }, [api, refreshArtifacts, refreshSessionEvents]);

  async function createProject(input: { name: string; workspacePath: string }) {
    const project = await api.createProject(input);
    setProjects((items) => upsertById(items, project));
    setSelectedProjectId(project.id);
    setActiveRoute("workspace");
  }

  async function pickWorkspace() {
    const result = await api.pickWorkspace();
    return result.workspacePath;
  }

  async function deleteProject(projectId: string) {
    await api.deleteProject(projectId);
    const remainingProjects = projects.filter((project) => project.id !== projectId);
    setProjects(remainingProjects);
    if (selectedProjectId === projectId) {
      setSelectedProjectId(remainingProjects[0]?.id);
      setSessions([]);
      setActiveSessionId(undefined);
      setArtifacts([]);
      setSelectedArtifactId(undefined);
      setArtifactPreviews({});
    }
  }

  async function runTask(prompt: string) {
    if (!selectedProject) {
      setError("Create or select a project first.");
      return;
    }

    setIsRunning(true);
    setError(undefined);
    let pollTimer: number | undefined;
    const createdAt = new Date().toISOString();
    const optimisticMessage: ConversationMessageDto = {
      id: `client-message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: "user",
      content: prompt,
      createdAt
    };
    const providerProfileId =
      selectedProviderProfileId ?? settings?.providerProfiles[0]?.id ?? "local";
    const existingSession =
      activeSession?.projectId === selectedProject.id ? activeSession : undefined;
    const optimisticSession: TaskSessionDto =
      existingSession ??
      {
        id: `client-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        projectId: selectedProject.id,
        title: prompt.slice(0, 48) || "Local run",
        status: "running",
        providerProfileId,
        messages: [],
        artifactIds: [],
        createdAt,
        updatedAt: createdAt
      };
    setSessions((items) =>
      upsertOptimisticUserMessage(items, optimisticSession, optimisticMessage)
    );
    setActiveSessionId(optimisticSession.id);
    setSessionEvents((current) => ({ ...current, [optimisticSession.id]: [] }));
    setActiveRoute("workspace");

    try {
      const session =
        existingSession ??
        (await api.createSession({
          projectId: selectedProject.id,
          title: prompt.slice(0, 48) || "Local run",
          providerProfileId
        }));
      if (!existingSession) {
        setSessions((items) =>
          upsertOptimisticUserMessage(
            items.filter((item) => item.id !== optimisticSession.id),
            session,
            optimisticMessage
          )
        );
        setSessionEvents((current) => ({ ...current, [session.id]: [] }));
      } else {
        setSessions((items) => upsertOptimisticUserMessage(items, session, optimisticMessage));
      }
      setActiveSessionId(session.id);
      const pollEvents = () => {
        void refreshSessionEvents(session.id).catch(() => undefined);
      };
      pollEvents();
      pollTimer = window.setInterval(pollEvents, 500);
      await api.sendMessage(session.id, prompt);
      window.clearInterval(pollTimer);
      pollTimer = undefined;
      await refreshSessionEvents(session.id);
      await refreshSession(session.id);
      setActiveRoute("workspace");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      if (pollTimer !== undefined) {
        window.clearInterval(pollTimer);
      }
      setIsRunning(false);
    }
  }

  function startNewChat() {
    setActiveSessionId(undefined);
    setArtifacts([]);
    setSelectedArtifactId(undefined);
    setArtifactPreviews({});
    setActiveRoute("workspace");
  }

  async function saveSettings(next: GlobalSettingsDto) {
    const saved = await api.saveSettings(next);
    setSettings(saved);
    const [nextTools, nextMcpTools, nextSkills] = await Promise.all([
      api.listTools(),
      api.listMcpTools(),
      api.listSkills()
    ]);
    setTools(nextTools);
    setMcpTools(nextMcpTools);
    setSkills(nextSkills);
    setSelectedProviderProfileId((current) =>
      saved.providerProfiles.some((profile) => profile.id === current)
        ? current
        : saved.providerProfiles[0]?.id
    );
  }

  async function testProvider(profile: ProviderProfileDto) {
    setProviderTest(await api.testProvider(profile));
  }

  async function testMcp(serverId?: string) {
    setMcpTest(await api.testMcp(serverId));
    setMcpTools(await api.listMcpTools());
  }

  function routeContent() {
    if (activeRoute === "projects") {
      return (
        <ProjectsPage
          projects={projects}
          selectedProjectId={selectedProjectId}
          onCreateProject={createProject}
          onPickWorkspace={pickWorkspace}
          onSelectProject={(projectId) => {
            setSelectedProjectId(projectId);
            setActiveRoute("workspace");
          }}
          onDeleteProject={deleteProject}
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
    if (activeRoute === "settings") {
      return (
        <SettingsPage
          settings={settings}
          tools={tools}
          mcpTools={mcpTools}
          skills={skills}
          providerTest={providerTest}
          mcpTest={mcpTest}
          onSaveSettings={saveSettings}
          onTestProvider={testProvider}
          onTestMcp={testMcp}
          onReloadIntegrations={refreshIntegrations}
        />
      );
    }
    return (
      <WorkspacePage
        projects={projects}
        selectedProject={selectedProject}
        providerProfiles={settings?.providerProfiles ?? []}
        selectedProviderProfileId={selectedProviderProfileId}
        sessions={sessions}
        activeSession={activeSession}
        events={activeEvents}
        artifacts={artifactViews}
        isRunning={isRunning}
        error={error}
        onSelectProject={setSelectedProjectId}
        onSelectProviderProfile={setSelectedProviderProfileId}
        onSelectSession={refreshSession}
        onNewChat={startNewChat}
        onRun={runTask}
        onSelectArtifact={(artifactId) => {
          setSelectedArtifactId(artifactId);
          setActiveRoute("artifacts");
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-16 shrink-0 flex-col items-center gap-3 border-r bg-card px-2 py-3 md:flex">
        <Button
          variant="secondary"
          size="icon"
          title="Harness Agent"
          aria-label="Harness Agent"
          onClick={() => setActiveRoute("workspace")}
        >
          <TerminalSquare />
        </Button>
        <nav className="flex flex-col gap-1">
          {routes.map((item) => {
            const Icon = icons[item.id];
            return (
              <Button
                key={item.id}
                variant={item.id === activeRoute ? "secondary" : "ghost"}
                size="icon"
                title={item.label}
                aria-label={item.label}
                onClick={() => setActiveRoute(item.id)}
              >
                <Icon />
              </Button>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card px-4 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <TerminalSquare data-icon="inline-start" />
            <h1 className="truncate text-sm font-semibold">Harness Agent</h1>
          </div>
          <nav className="flex gap-1">
            {routes.map((item) => {
              const Icon = icons[item.id];
              return (
                <Button
                  key={item.id}
                  variant={item.id === activeRoute ? "secondary" : "ghost"}
                  size="icon"
                  title={item.label}
                  aria-label={item.label}
                  onClick={() => setActiveRoute(item.id)}
                >
                  <Icon />
                </Button>
              );
            })}
          </nav>
        </header>
        <main
          className={
            activeRoute === "workspace"
              ? "min-h-0 min-w-0 flex-1"
              : "mx-auto min-h-screen w-full max-w-7xl px-4 py-4"
          }
        >
          {routeContent()}
        </main>
      </div>
    </div>
  );
}
