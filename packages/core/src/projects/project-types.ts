export interface Project {
  id: string;
  name: string;
  workspacePath: string;
  defaultProviderProfileId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectContext {
  project: Project;
  sessionId?: string;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  createdAt: string;
}

export interface TaskSession {
  id: string;
  projectId: string;
  title: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  providerProfileId: string;
  messages: ConversationMessage[];
  artifactIds: string[];
  createdAt: string;
  updatedAt: string;
}
