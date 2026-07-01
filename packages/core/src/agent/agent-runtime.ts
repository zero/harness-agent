import type { AgentEvent } from "../events/agent-events";
import type { Project } from "../projects/project-types";
import type { LlmProvider, ProviderRequest } from "../providers/provider-types";
import type { ToolRegistry } from "../tools/tool-registry";

export interface AgentRuntimeOptions {
  provider: LlmProvider;
  tools: ToolRegistry;
  maxSteps?: number;
}

export interface RunTaskRequest {
  sessionId: string;
  messageId: string;
  project: Project;
  providerRequest: ProviderRequest;
}

export class AgentRuntime {
  private readonly provider: LlmProvider;
  private readonly tools: ToolRegistry;
  private readonly maxSteps: number;

  constructor(options: AgentRuntimeOptions) {
    this.provider = options.provider;
    this.tools = options.tools;
    this.maxSteps = options.maxSteps ?? 8;
  }

  async *runTask(request: RunTaskRequest): AsyncIterable<AgentEvent> {
    yield { type: "session.started", sessionId: request.sessionId };

    let steps = 0;
    for await (const providerEvent of this.provider.complete(request.providerRequest)) {
      if (providerEvent.type === "message.delta") {
        yield {
          type: "message.delta",
          messageId: request.messageId,
          text: providerEvent.text
        };
        continue;
      }

      if (providerEvent.type === "tool.call") {
        steps += 1;
        if (steps > this.maxSteps) {
          yield {
            type: "error",
            message: `Agent step limit exceeded: ${this.maxSteps}`,
            recoverable: false
          };
          break;
        }

        yield {
          type: "tool.call",
          callId: providerEvent.id,
          toolName: providerEvent.name,
          input: providerEvent.input
        };

        const output = await this.tools.call(providerEvent.name, {
          project: request.project,
          input: providerEvent.input
        });

        yield {
          type: "tool.result",
          callId: providerEvent.id,
          toolName: providerEvent.name,
          output
        };
        continue;
      }

      if (providerEvent.type === "message.completed") {
        yield { type: "message.completed", messageId: request.messageId };
        continue;
      }

      if (providerEvent.type === "error") {
        yield {
          type: "error",
          message: providerEvent.message,
          recoverable: true
        };
      }
    }

    yield { type: "session.completed", sessionId: request.sessionId };
  }
}
