# Harness Agent Design

## Purpose

Build a local, single-user, browser/server harness engineering agent prototype in TypeScript. The agent should help a user complete complex local tasks through a browser UI while the local server performs bounded filesystem work, command execution, provider calls, MCP tool calls, skill-assisted workflows, and artifact generation inside the selected project workspace.

The prototype is not a multi-user SaaS product. It should feel closer to Claude Code or Codex running locally with a browser-based control surface.

## Confirmed Scope

- Full browser/server architecture.
- TypeScript across frontend, backend, runtime, tools, and tests.
- Single-user local execution.
- Project concept with a selected workspace directory.
- Project workspace boundary enforced for filesystem, code execution, and generated artifacts.
- Global enable/disable settings for tools, MCP servers, skills, and provider profiles.
- Provider support for OpenAI, Anthropic, and OpenAI-compatible APIs, including DeepSeek and other common Chinese model providers that expose OpenAI-compatible endpoints.
- MCP server integration for stdio and HTTP/SSE style connections.
- Local skills support with `SKILL.md` entrypoints and a skill creator tool.
- Built-in filesystem, code execution, free web fetch/search, document generation, spreadsheet generation, HTML/PDF generation, and artifact management.
- Shadcn/ui and Tailwind CSS frontend.
- Solid conversation experience with rich Markdown rendering and inline artifact cards.
- Artifact preview support for generated files.
- Tests colocated beside the module under test.

## Non-Goals

- Multi-user accounts, organizations, auth, billing, or cloud tenancy.
- Production-grade container isolation.
- Distributed task queue infrastructure.
- A marketplace for tools or skills.
- Automatic skill routing beyond explicit enablement plus simple trigger matching.
- A landing page or marketing-style website.

## Repository Layout

All workspace packages live under `packages/`. There is no separate `apps/` directory.

```txt
packages/
  web/
    src/
      app/
      components/
      lib/
  server/
    src/
      api/
      config/
      projects/
      sessions/
  core/
    src/
      agent/
      artifacts/
      events/
      mcp/
      projects/
      providers/
      skills/
      tools/
  tools/
    src/
      code-execution/
      filesystem/
      web/
      documents/
      spreadsheets/
      skill-creator/
  mcp-fixtures/
    src/
  example-skills/
    writer/
      SKILL.md
      templates/
      scripts/
```

Test files live beside implementation files:

```txt
packages/core/src/providers/openai.ts
packages/core/src/providers/openai.test.ts
packages/tools/src/filesystem/filesystem.ts
packages/tools/src/filesystem/filesystem.test.ts
packages/server/src/projects/project-routes.ts
packages/server/src/projects/project-routes.test.ts
```

Cross-package integration tests live in the package that owns the behavior being verified. For example, agent loop tests live in `packages/core/src/agent/`, while API/SSE smoke tests live in `packages/server/src/`.

## Project Model

`Project` is a first-class local workspace concept.

```ts
export interface Project {
  id: string;
  name: string;
  workspacePath: string;
  defaultProviderProfileId?: string;
  createdAt: string;
  updatedAt: string;
}
```

A `TaskSession` always belongs to one project:

```ts
export interface TaskSession {
  id: string;
  projectId: string;
  title: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  providerProfileId: string;
  messages: ConversationMessage[];
  artifacts: Artifact[];
  createdAt: string;
  updatedAt: string;
}
```

The project boundary controls local side effects:

- Filesystem tools may only read and write inside `project.workspacePath`.
- Code execution defaults to `project.workspacePath` as `cwd`.
- Code execution may not use a `cwd` outside `project.workspacePath`.
- Artifact files are written under `.harness-agent/artifacts/<taskId>/` inside the project workspace.
- Generated skills created by the skill creator tool are written inside the project workspace unless the user chooses an allowed global skill directory in settings.
- Server routes that expose artifacts or previews verify that resolved paths remain inside the owning project workspace.

## Global Settings Model

Tool, MCP, skill, and provider enablement is global, not project-scoped.

```ts
export interface GlobalSettings {
  providerProfiles: ProviderProfile[];
  enabledToolIds: string[];
  mcpServers: McpServerConfig[];
  enabledMcpServerIds: string[];
  skillPaths: string[];
  enabledSkillPaths: string[];
  commandPolicy: CommandPolicy;
  webPolicy: WebPolicy;
}
```

When a task starts, runtime context is assembled from:

- The selected project and its `workspacePath`.
- Globally enabled built-in tools.
- Globally enabled MCP servers.
- Globally enabled skill paths.
- The selected provider profile, falling back to the project's default provider profile when present.

## Runtime Architecture

`packages/server` owns HTTP, SSE, local persistence, process lifecycle, and project-aware policy enforcement. `packages/core` owns pure agent behavior and should remain independent from the web framework.

Core units:

- `AgentRuntime`: accepts a task request and emits an async stream of structured events.
- `TaskSessionStore`: stores messages, status, artifacts, errors, and event history.
- `ProviderRegistry`: resolves provider profiles to provider implementations.
- `ToolRegistry`: normalizes built-in tools, MCP tools, and skill tools behind one call interface.
- `McpRegistry`: connects to configured MCP servers and exposes their tools.
- `SkillRegistry`: loads enabled skills and exposes instructions/resources to the runtime.
- `ArtifactRegistry`: records generated artifacts and preview metadata.
- `ProjectPolicy`: validates workspace-relative filesystem and command operations.

The runtime event stream uses structured events:

```ts
export type AgentEvent =
  | { type: "session.started"; sessionId: string }
  | { type: "message.delta"; messageId: string; text: string }
  | { type: "message.completed"; messageId: string }
  | { type: "tool.call"; callId: string; toolName: string; input: unknown }
  | { type: "tool.result"; callId: string; toolName: string; output: unknown }
  | { type: "artifact.created"; artifact: Artifact }
  | { type: "error"; message: string; recoverable: boolean }
  | { type: "session.completed"; sessionId: string };
```

The first agent loop can be a pragmatic tool-calling loop:

1. Build system context from global settings, project context, enabled skills, and available tools.
2. Send conversation state to the selected provider.
3. Stream assistant text deltas to the UI.
4. Execute requested tool calls through `ToolRegistry`.
5. Append tool results to conversation state.
6. Continue until provider finishes or configured step limit is reached.
7. Persist final response, events, and artifacts.

## Provider Design

All providers implement one internal interface:

```ts
export interface LlmProvider {
  id: string;
  complete(request: ProviderRequest): AsyncIterable<ProviderEvent>;
}
```

Internal request and event shapes hide protocol differences:

```ts
export interface ProviderRequest {
  model: string;
  systemPrompt: string;
  messages: ProviderMessage[];
  tools: ProviderTool[];
  temperature?: number;
  maxTokens?: number;
}
```

Supported provider families:

- `openai`: OpenAI API profile with API key, base URL, model, and streaming support.
- `anthropic`: Anthropic Messages profile with message/tool conversion.
- `openai-compatible`: OpenAI-compatible chat completions for DeepSeek, Qwen-compatible gateways, Moonshot, Zhipu-compatible gateways, and similar endpoints.

Provider tests verify:

- System prompt mapping.
- User/assistant/tool role mapping.
- Tool schema conversion.
- Tool call parsing.
- Streaming chunk normalization.
- Error normalization.
- OpenAI-compatible base URL and API key configuration.

## Built-In Tools

Built-in tools live in `packages/tools` and are registered by `packages/server`.

### Filesystem

Capabilities:

- Read text files.
- Write text files.
- List directories.
- Create directories.
- Search text with project-bound path resolution.
- Return file metadata.

Safety:

- Resolve real paths before access.
- Reject path traversal outside `project.workspacePath`.
- Limit response size.

### Code Execution

Capabilities:

- Execute shell commands in the project workspace.
- Support timeout, stdout/stderr truncation, and exit code reporting.
- Accept a limited environment derived from server config.

Safety:

- Default `cwd` is `project.workspacePath`.
- Reject any requested `cwd` outside the project workspace.
- Apply timeout by killing the child process.
- Store command summaries as artifacts when useful.

### Web Fetch And Web Search

Capabilities:

- Fetch URL content with timeout and response-size limits.
- Extract title, text, links, and metadata.
- Search the web using a configurable free provider.

Search provider behavior:

- Prefer configured SearxNG endpoint.
- Provide a free fallback using public HTML search endpoints where practical.
- Return structured results with title, URL, snippet, and source.

### Artifact Generation

The artifact tools generate durable files under `.harness-agent/artifacts/<taskId>/`.

Supported artifact kinds:

```ts
export type ArtifactKind =
  | "markdown"
  | "html"
  | "csv"
  | "xlsx"
  | "docx"
  | "pptx"
  | "pdf"
  | "json"
  | "text"
  | "image";
```

First-version generation tools:

- Markdown/text/json writer.
- HTML generator with safe static output.
- CSV writer.
- XLSX generator.
- DOCX generator.
- PPTX generator.
- PDF generator from structured content, supporting title, paragraphs, lists, tables, and image blocks without requiring an external system binary.

Each artifact includes:

```ts
export interface Artifact {
  id: string;
  sessionId: string;
  projectId: string;
  kind: ArtifactKind;
  title: string;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  preview?: ArtifactPreview;
  createdAt: string;
}
```

### Skill Creator

The skill creator tool writes a standard local skill skeleton:

```txt
<skill-name>/
  SKILL.md
  scripts/
  templates/
  assets/
```

The generated `SKILL.md` includes name, description, trigger hints, usage instructions, and resource conventions.

## MCP Integration

MCP support lives in `packages/core/src/mcp`.

Supported server configs:

```ts
export type McpServerConfig =
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
```

Behavior:

- Connect only to globally enabled MCP servers.
- List MCP tools and normalize them into `ToolDefinition`.
- Execute MCP tool calls through the same `ToolRegistry` as built-in tools.
- Apply timeouts and error normalization.
- Surface MCP connection status in settings.
- Provide `packages/mcp-fixtures` mock servers for tests and demos.

Project safety:

- Built-in tools enforce workspace boundaries directly.
- MCP tools are treated as external capabilities. The UI labels them clearly, and task context includes the current project path.
- Any first-party MCP fixture that accesses files must enforce the same project path policy.

First-version community integration targets:

- Filesystem MCP fixture and configuration example.
- Free web fetch/search MCP fixture and configuration example.
- Artifact generation MCP fixture covering markdown, HTML, CSV, XLSX, DOCX, PPTX, PDF, JSON, and text.
- Skill creator skill and MCP fixture for testing skill skeleton creation through both native tools and MCP calls.

## Skills

Skills are local directories with a `SKILL.md` entrypoint.

```txt
some-skill/
  SKILL.md
  scripts/
  templates/
  assets/
```

`SkillRegistry` behavior:

- Scan globally configured skill paths.
- Load enabled skill `SKILL.md` files.
- Parse metadata from frontmatter when present.
- Expose instructions and resources to `AgentRuntime`.
- Support simple keyword matching and explicit user selection.
- Surface load errors in the Settings / Skills page.

The first version keeps skill routing simple:

- Explicitly enabled skills are available.
- Matching skills may be injected when the task text matches name, description, or trigger hints.
- The user can manually enable/disable skill paths globally.

## Server API

`packages/server` exposes local-only HTTP APIs.

Core routes:

- `GET /api/health`
- `GET /api/projects`
- `POST /api/projects`
- `PATCH /api/projects/:projectId`
- `DELETE /api/projects/:projectId`
- `GET /api/settings`
- `PUT /api/settings`
- `POST /api/providers/test`
- `POST /api/mcp/test`
- `GET /api/sessions?projectId=...`
- `POST /api/sessions`
- `GET /api/sessions/:sessionId`
- `POST /api/sessions/:sessionId/messages`
- `POST /api/sessions/:sessionId/cancel`
- `GET /api/sessions/:sessionId/events`
- `GET /api/artifacts/:artifactId`
- `GET /api/artifacts/:artifactId/preview`

The session events endpoint streams `AgentEvent` objects over SSE.

Persistence can start with local JSON files under a server data directory:

```txt
.harness-agent-local/
  settings.json
  projects.json
  sessions/
```

Per-project artifacts remain under the project workspace.

## Frontend Experience

`packages/web` uses:

- React.
- Vite.
- Tailwind CSS.
- shadcn/ui.
- TanStack Query.
- SSE client for task events.
- Markdown renderer with GFM, code highlighting, Mermaid, math support, link handling, and sanitization.

The UI is a compact local engineering console, not a landing page.

Primary navigation:

- Projects.
- Workspace.
- Runs.
- Artifacts.
- Settings.

### Projects

Users can:

- Create a project.
- Pick a local workspace path.
- Rename a project.
- Set a default provider profile.
- Open a project workspace.

### Workspace

The project workspace is conversation-first:

- Left panel: project switcher and session history.
- Center panel: chat/document stream.
- Right panel: tabs for Artifacts, Files, and Run Events.

Conversation stream supports:

- User messages.
- Streaming assistant Markdown.
- Tool call/result blocks that can be collapsed.
- Error blocks with retry affordances.
- Inline artifact cards.
- Run status indicators.

Markdown support includes:

- Headings, paragraphs, emphasis, links, images.
- GFM tables and task lists.
- Fenced code blocks with syntax highlighting.
- Mermaid diagrams.
- Math rendering.
- Blockquotes and nested lists.
- Sanitized HTML output without script execution.

### Artifact Preview

Artifacts are visible both inline in the conversation and in the right-side Artifacts panel.

Preview behavior:

- `markdown`: rich Markdown preview.
- `html`: sandboxed iframe preview.
- `csv`: table preview.
- `xlsx`: workbook/sheet table preview.
- `docx`: extracted text/HTML preview plus metadata and download.
- `pptx`: slide list, extracted text/metadata, and download.
- `pdf`: embedded browser PDF preview plus download.
- `json`: formatted JSON preview.
- `text`: text preview.
- `image`: image preview.

Every preview route validates artifact ownership and project workspace containment.

### Settings

Settings pages:

- Providers: add/test OpenAI, Anthropic, and OpenAI-compatible profiles; include DeepSeek as a preset template.
- Tools: globally enable/disable built-in tools.
- MCP: add/test stdio and HTTP MCP servers; inspect discovered tools.
- Skills: add skill paths, scan skills, enable/disable skill paths, create a new skill.
- Safety: configure command timeout, output limits, web timeout, response-size limits, and environment allowlist.

## Testing Strategy

Use Vitest for TypeScript unit and integration tests. Tests are colocated with source modules.

Required package coverage:

### `packages/core`

- Provider request conversion tests.
- Provider streaming normalization tests.
- Agent loop tool-call tests.
- Project policy path containment tests.
- MCP adapter tests using fixtures.
- Skill loader tests.
- Artifact registry tests.

### `packages/tools`

- Filesystem read/write/list/search tests inside workspace.
- Filesystem rejection tests outside workspace.
- Command execution cwd, timeout, exit code, and truncation tests.
- Web fetch tests with local mock server.
- Web search adapter tests with mocked HTML/API responses.
- Markdown/html/csv/xlsx/docx/pptx/pdf artifact generation tests.
- Skill creator skeleton tests.

### `packages/server`

- Project CRUD route tests.
- Settings route tests.
- Provider/MCP test route tests.
- Session creation tests.
- SSE event smoke tests.
- Artifact download and preview route tests.

### `packages/web`

- Project creation form tests.
- Provider settings form tests.
- Tool enable/disable tests.
- Conversation stream rendering tests.
- Markdown renderer tests.
- Artifact preview component tests.
- Workspace page render smoke tests.

### `packages/mcp-fixtures`

- Mock MCP server self-tests.
- Tool listing and tool call response tests.

Repository verification commands:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Acceptance Criteria

The prototype is ready when:

- A user can start the server and web UI locally.
- A user can create a project with a workspace directory.
- A user can configure at least one provider profile.
- OpenAI, Anthropic, and OpenAI-compatible profile conversion paths are tested.
- DeepSeek can be configured through an OpenAI-compatible preset.
- A user can run a task from the project workspace conversation UI.
- The runtime can stream assistant responses to the UI.
- The runtime can call built-in tools and show tool events in the conversation.
- Filesystem and command tools cannot operate outside the selected project workspace.
- A user can configure and test a mock MCP server.
- MCP tools can be listed and called through the same tool registry.
- A user can add, scan, enable, and disable a local skill path.
- The skill creator can generate a valid local skill skeleton.
- The agent can generate markdown, HTML, CSV, XLSX, DOCX, PPTX, PDF, JSON, and text artifacts.
- Artifact files are written under the owning project workspace.
- Artifact cards appear in the conversation.
- Artifact previews render in the UI for supported preview types.
- Tests are colocated with source files.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass.
