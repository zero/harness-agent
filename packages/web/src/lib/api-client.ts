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
      }).then(readJson<ProjectDto>)
  };
}
