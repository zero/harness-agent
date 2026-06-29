import type { Artifact } from "../artifacts/artifact-types";

export type AgentEvent =
  | { type: "session.started"; sessionId: string }
  | { type: "message.delta"; messageId: string; text: string }
  | { type: "message.completed"; messageId: string }
  | { type: "tool.call"; callId: string; toolName: string; input: unknown }
  | { type: "tool.result"; callId: string; toolName: string; output: unknown }
  | { type: "artifact.created"; artifact: Artifact }
  | { type: "error"; message: string; recoverable: boolean }
  | { type: "session.completed"; sessionId: string };
