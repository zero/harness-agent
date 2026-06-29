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

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? "";
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = (path: string) => `${baseUrl}${path}`;

  return {
    listProjects: () => fetchImpl(url("/api/projects")).then(readJson<ProjectDto[]>),
    getSettings: () => fetchImpl(url("/api/settings")).then(readJson<unknown>),
    createProject: (input: { name: string; workspacePath: string }) =>
      fetchImpl(url("/api/projects"), {
        method: "POST",
        body: JSON.stringify(input),
        headers: { "content-type": "application/json" }
      }).then(readJson<ProjectDto>),
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
