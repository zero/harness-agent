import type { ToolCallContext, ToolDefinition, ToolHandler, RegisteredTool } from "./tool-types";

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  register(definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.id, { definition, handler });
  }

  list(enabledToolIds?: string[]): ToolDefinition[] {
    const enabled = enabledToolIds ? new Set(enabledToolIds) : undefined;

    return [...this.tools.values()]
      .filter((tool) => !enabled || enabled.has(tool.definition.id))
      .map((tool) => tool.definition);
  }

  async call(toolId: string, context: ToolCallContext): Promise<unknown> {
    const tool = this.tools.get(toolId);

    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`);
    }

    return tool.handler(context);
  }
}
