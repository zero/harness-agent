import type { McpAdapter, McpServerConfig, ToolDefinition } from "@harness-agent/core";

export const mcpFixturesPackageName = "@harness-agent/mcp-fixtures";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: unknown;
}

export type JsonRpcResponse =
  | {
      jsonrpc: "2.0";
      id: string | number;
      result: unknown;
    }
  | {
      jsonrpc: "2.0";
      id: string | number;
      error: {
        code: number;
        message: string;
      };
    };

const objectSchema = { type: "object" as const, properties: {} };

export const communityMcpFixtureTools: ToolDefinition[] = [
  {
    id: "mcp.filesystem.read_file",
    name: "Read file",
    description: "Fixture for the community filesystem MCP read_file tool.",
    inputSchema: objectSchema
  },
  {
    id: "mcp.filesystem.write_file",
    name: "Write file",
    description: "Fixture for the community filesystem MCP write_file tool.",
    inputSchema: objectSchema
  },
  {
    id: "mcp.web.fetch",
    name: "Fetch URL",
    description: "Fixture for a free web fetch MCP tool.",
    inputSchema: objectSchema
  },
  {
    id: "mcp.web.search",
    name: "Search web",
    description: "Fixture for a free web search MCP tool.",
    inputSchema: objectSchema
  },
  {
    id: "mcp.artifact.write",
    name: "Write artifact",
    description: "Fixture for markdown, html, csv, xlsx, docx, pptx, and pdf artifact generation.",
    inputSchema: objectSchema
  },
  {
    id: "mcp.skill.create",
    name: "Create skill",
    description: "Fixture for creating a local skill skeleton.",
    inputSchema: objectSchema
  }
];

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function success(id: string | number, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function failure(id: string | number, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export class CommunityMcpFixtureServer {
  private readonly files = new Map<string, string>([
    ["README.md", "# Fixture workspace\n\nThis file is served by the MCP filesystem fixture."]
  ]);

  async handle(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (request.method === "initialize") {
      return success(request.id, {
        protocolVersion: "2024-11-05",
        serverInfo: {
          name: "harness-agent-community-fixtures",
          version: "0.0.0"
        },
        capabilities: {
          tools: {}
        }
      });
    }

    if (request.method === "tools/list") {
      return success(request.id, { tools: communityMcpFixtureTools });
    }

    if (request.method === "tools/call") {
      const params = asRecord(request.params);
      const name = String(params.name ?? "");
      const input = asRecord(params.arguments);

      try {
        return success(request.id, await this.callTool(name, input));
      } catch (error) {
        return failure(request.id, -32_000, (error as Error).message);
      }
    }

    return failure(request.id, -32_601, `Method not found: ${request.method}`);
  }

  private async callTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    if (name === "mcp.filesystem.read_file") {
      const path = String(input.path ?? "README.md");
      return {
        path,
        content: this.files.get(path) ?? ""
      };
    }

    if (name === "mcp.filesystem.write_file") {
      const path = String(input.path ?? "untitled.txt");
      const content = String(input.content ?? "");
      this.files.set(path, content);
      return { ok: true, path, bytes: Buffer.byteLength(content) };
    }

    if (name === "mcp.web.fetch") {
      const url = String(input.url ?? "https://example.com");
      return {
        url,
        title: "Fixture web page",
        text: "A deterministic web fetch response for local MCP integration tests.",
        links: ["https://example.com/docs", "https://example.com/search"]
      };
    }

    if (name === "mcp.web.search") {
      const query = String(input.query ?? "");
      return {
        query,
        results: [
          {
            title: "Harness Agent Fixture Result",
            url: "https://example.com/harness-agent",
            snippet: `Search result for ${query}`
          },
          {
            title: "Local MCP Fixture",
            url: "https://example.com/mcp-fixture",
            snippet: "Deterministic fixture for free web search wiring."
          }
        ]
      };
    }

    if (name === "mcp.artifact.write") {
      const kind = String(input.kind ?? "markdown");
      const title = String(input.title ?? "Untitled Artifact");
      return {
        id: `fixture-artifact-${kind}`,
        kind,
        title,
        relativePath: `.harness-agent/artifacts/fixture/${title.toLowerCase().replace(/\W+/g, "-")}.${kind}`
      };
    }

    if (name === "mcp.skill.create") {
      const nameInput = String(input.name ?? "new-skill");
      return {
        name: nameInput,
        path: `.harness-agent/skills/${nameInput}/SKILL.md`,
        files: ["SKILL.md", "scripts/", "templates/", "assets/"]
      };
    }

    throw new Error(`Fixture MCP tool not found: ${name}`);
  }
}

export function createCommunityMcpFixtureServer(): CommunityMcpFixtureServer {
  return new CommunityMcpFixtureServer();
}

export function createFixtureMcpAdapter(
  server = createCommunityMcpFixtureServer()
): McpAdapter {
  let nextId = 1;

  async function request(method: string, params?: unknown): Promise<unknown> {
    const response = await server.handle({
      jsonrpc: "2.0",
      id: nextId,
      method,
      params
    });
    nextId += 1;

    if ("error" in response) {
      throw new Error(response.error.message);
    }

    return response.result;
  }

  return {
    async listTools(_server: McpServerConfig) {
      const result = asRecord(await request("tools/list"));
      return (result.tools ?? []) as ToolDefinition[];
    },
    async callTool(_server: McpServerConfig, toolId: string, input: unknown) {
      return request("tools/call", { name: toolId, arguments: input });
    }
  };
}
