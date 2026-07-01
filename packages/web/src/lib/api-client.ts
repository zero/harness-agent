export interface ApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface ProjectDto {
  id: string;
  name: string;
  workspacePath: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspacePickResultDto {
  workspacePath?: string;
}

export type ProviderKindDto = "openai" | "anthropic" | "openai-compatible";

export interface ProviderProfileDto {
  id: string;
  name: string;
  kind: ProviderKindDto;
  baseUrl: string;
  apiKeyEnv: string;
  model: string;
}

export type McpServerDto =
  | {
      id: string;
      name: string;
      transport: "stdio";
      command: string;
      args: string[];
      env?: Record<string, string>;
    }
  | {
      id: string;
      name: string;
      transport: "http";
      url: string;
      headers?: Record<string, string>;
    };

export interface GlobalSettingsDto {
  providerProfiles: ProviderProfileDto[];
  enabledToolIds: string[];
  mcpServers: McpServerDto[];
  enabledMcpServerIds: string[];
  skillPaths: string[];
  enabledSkillPaths: string[];
  commandPolicy: {
    timeoutMs: number;
    maxOutputBytes: number;
    allowedEnvKeys: string[];
  };
  webPolicy: {
    timeoutMs: number;
    maxResponseBytes: number;
    searchEndpoint?: string;
  };
}

export interface ToolDefinitionDto {
  id: string;
  name: string;
  description: string;
  enabled?: boolean;
}

export interface SkillDto {
  name: string;
  description: string;
  path: string;
  triggers: string[];
  enabled?: boolean;
}

export interface SkillLoadResultDto {
  skills: SkillDto[];
  errors: Array<{ path: string; message: string }>;
}

export interface ProviderTestResultDto {
  ok: boolean;
  profileId?: string;
  kind?: ProviderKindDto;
  model?: string;
  baseUrl?: string;
  apiKeyEnv?: string;
  apiKeyConfigured?: boolean;
  apiKeySource?: "env" | "direct" | "missing";
  message: string;
}

export interface McpTestResultDto {
  ok: boolean;
  serverId?: string;
  toolCount?: number;
  tools?: ToolDefinitionDto[];
  message?: string;
}

export interface ConversationMessageDto {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  createdAt: string;
}

export interface TaskSessionDto {
  id: string;
  projectId: string;
  title: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  providerProfileId: string;
  messages: ConversationMessageDto[];
  artifactIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type AgentEventDto =
  | { type: "session.started"; sessionId: string }
  | { type: "thinking"; summary: string }
  | { type: "message.delta"; messageId: string; text: string }
  | { type: "message.completed"; messageId: string }
  | { type: "skill.match"; skillName: string; path: string; reason: string }
  | { type: "tool.call"; callId: string; toolName: string; input: unknown }
  | { type: "tool.result"; callId: string; toolName: string; output: unknown }
  | { type: "artifact.created"; artifact: ArtifactDto }
  | { type: "error"; message: string; recoverable: boolean }
  | { type: "session.completed"; sessionId: string };

export interface ArtifactDto {
  id: string;
  sessionId: string;
  projectId: string;
  kind: "markdown" | "html" | "csv" | "xlsx" | "docx" | "pptx" | "pdf" | "json" | "text" | "image";
  title: string;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ArtifactPreviewDto {
  kind: ArtifactDto["kind"];
  title?: string;
  content?: string;
  rows?: Record<string, unknown>[];
  json?: unknown;
  mimeType?: string;
  sizeBytes?: number;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function readEmpty(response: Response): Promise<void> {
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? "";
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = (path: string) => `${baseUrl}${path}`;

  return {
    listProjects: () => fetchImpl(url("/api/projects")).then(readJson<ProjectDto[]>),
    getSettings: () => fetchImpl(url("/api/settings")).then(readJson<GlobalSettingsDto>),
    saveSettings: (settings: GlobalSettingsDto) =>
      fetchImpl(url("/api/settings"), {
        method: "PUT",
        body: JSON.stringify(settings),
        headers: { "content-type": "application/json" }
      }).then(readJson<GlobalSettingsDto>),
    listTools: () => fetchImpl(url("/api/tools")).then(readJson<ToolDefinitionDto[]>),
    listMcpTools: () => fetchImpl(url("/api/mcp/tools")).then(readJson<ToolDefinitionDto[]>),
    listSkills: () => fetchImpl(url("/api/skills")).then(readJson<SkillLoadResultDto>),
    testProvider: (profile: ProviderProfileDto) =>
      fetchImpl(url("/api/providers/test"), {
        method: "POST",
        body: JSON.stringify({ profile }),
        headers: { "content-type": "application/json" }
      }).then(readJson<ProviderTestResultDto>),
    testMcp: (serverId?: string) =>
      fetchImpl(url("/api/mcp/test"), {
        method: "POST",
        body: JSON.stringify({ serverId }),
        headers: { "content-type": "application/json" }
      }).then(readJson<McpTestResultDto>),
    createProject: (input: { name: string; workspacePath: string }) =>
      fetchImpl(url("/api/projects"), {
        method: "POST",
        body: JSON.stringify(input),
        headers: { "content-type": "application/json" }
      }).then(readJson<ProjectDto>),
    pickWorkspace: () =>
      fetchImpl(url("/api/workspaces/pick"), {
        method: "POST"
      }).then(readJson<WorkspacePickResultDto>),
    deleteProject: (projectId: string) =>
      fetchImpl(url(`/api/projects/${encodeURIComponent(projectId)}`), {
        method: "DELETE"
      }).then(readEmpty),
    listSessions: (projectId?: string) =>
      fetchImpl(url(`/api/sessions${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`)).then(
        readJson<TaskSessionDto[]>
      ),
    createSession: (input: { projectId: string; title: string; providerProfileId?: string }) =>
      fetchImpl(url("/api/sessions"), {
        method: "POST",
        body: JSON.stringify(input),
        headers: { "content-type": "application/json" }
      }).then(readJson<TaskSessionDto>),
    getSession: (sessionId: string) =>
      fetchImpl(url(`/api/sessions/${encodeURIComponent(sessionId)}`)).then(readJson<TaskSessionDto>),
    listSessionEvents: (sessionId: string) =>
      fetchImpl(url(`/api/sessions/${encodeURIComponent(sessionId)}/events.json`)).then(
        readJson<AgentEventDto[]>
      ),
    sendMessage: (sessionId: string, content: string) =>
      fetchImpl(url(`/api/sessions/${encodeURIComponent(sessionId)}/messages`), {
        method: "POST",
        body: JSON.stringify({ content }),
        headers: { "content-type": "application/json" }
      }).then(readJson<{ ok: boolean; events: number }>),
    listArtifacts: (input: { projectId?: string; sessionId?: string } = {}) => {
      const params = new URLSearchParams();
      if (input.projectId) params.set("projectId", input.projectId);
      if (input.sessionId) params.set("sessionId", input.sessionId);
      const query = params.toString();
      return fetchImpl(url(`/api/artifacts${query ? `?${query}` : ""}`)).then(readJson<ArtifactDto[]>);
    },
    getArtifactPreview: (artifactId: string) =>
      fetchImpl(url(`/api/artifacts/${encodeURIComponent(artifactId)}/preview`)).then(
        readJson<ArtifactPreviewDto>
      ),
    artifactDownloadUrl: (artifactId: string) => url(`/api/artifacts/${encodeURIComponent(artifactId)}`)
  };
}
