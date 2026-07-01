import type { Project } from "../projects/project-types";
import type { JsonObjectSchema } from "../providers/provider-types";

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  inputSchema: JsonObjectSchema;
}

export interface ToolCallContext {
  project: Project;
  input: unknown;
}

export type ToolHandler = (context: ToolCallContext) => Promise<unknown>;

export interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}
