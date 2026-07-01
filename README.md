# harness-agent

A local, single-user TypeScript browser/server harness engineering agent prototype.

The prototype is designed for local work rather than SaaS multi-tenancy: a user creates a project,
points it at a workspace directory, and all filesystem access, command execution, and generated
artifacts are constrained to that project workspace.

## Architecture

This is a `packages/`-only pnpm monorepo:

- `packages/core`: provider adapters, project policy, agent runtime, tool registry, MCP registry, skill registry, and artifact types.
- `packages/tools`: workspace-scoped filesystem, command execution, free web fetch/search, artifact writers, and skill creator tools.
- `packages/server`: Hono API, JSON persistence, sessions, SSE event replay, artifact download/preview routes, and a no-key local runtime.
- `packages/web`: React, Vite, Tailwind CSS, and shadcn-style console for projects, chat, settings, runs, Markdown, and artifact previews.
- `packages/mcp-fixtures`: deterministic MCP-style fixture server and adapter for filesystem, web, artifact, and skill tools.
- `packages/example-skills`: sample local skills and templates used by tests and demos.

Unit tests are colocated with their modules, for example `sample.ts` and `sample.test.ts`.

## Capabilities

- Provider protocols: OpenAI, Anthropic, and OpenAI-compatible providers.
- China/open model profile: DeepSeek is the default OpenAI-compatible preset (`DEEPSEEK_API_KEY`).
- Local tools: filesystem read/write/list/search, shell command execution, web fetch, web search, artifact write, and skill creation.
- Artifacts: markdown, html, csv, xlsx, docx, pptx, pdf, json, text, and image metadata.
- Markdown stream: GFM, tables, task lists, math, sanitized HTML, code blocks, and Mermaid fence placeholders.
- MCP fixtures: filesystem, free web fetch/search, artifact generation, and skill creator coverage.
- Skills: global skill path enable/disable plus an example `writer` skill with a report template.

## Development

```bash
pnpm install
pnpm dev
```

Default local URLs:

- Server: `http://localhost:18787`
- Web console: `http://localhost:15173`

The default runtime does not require an API key. Sending a message creates demo artifacts inside
the selected project's `.harness-agent/artifacts/<session-id>/` directory and exposes them through
the server preview/download APIs.

## Provider Profiles

Provider profiles live in global settings, not per-project settings. Projects may reference a
default profile, but tool/skill/MCP enablement is global.

DeepSeek is preconfigured:

```bash
export DEEPSEEK_API_KEY=...
```

Additional profiles can use these shapes:

```json
{
  "id": "openai-gpt",
  "name": "OpenAI GPT",
  "kind": "openai",
  "baseUrl": "https://api.openai.com/v1",
  "apiKeyEnv": "OPENAI_API_KEY",
  "model": "gpt-4.1"
}
```

```json
{
  "id": "anthropic-claude",
  "name": "Anthropic Claude",
  "kind": "anthropic",
  "baseUrl": "https://api.anthropic.com",
  "apiKeyEnv": "ANTHROPIC_API_KEY",
  "model": "claude-sonnet-4-5"
}
```

```json
{
  "id": "openai-compatible-local",
  "name": "OpenAI-Compatible Local",
  "kind": "openai-compatible",
  "baseUrl": "http://localhost:11434/v1",
  "apiKeyEnv": "LOCAL_LLM_API_KEY",
  "model": "qwen2.5-coder"
}
```

## MCP And Skills

`packages/mcp-fixtures` exports `createCommunityMcpFixtureServer()` and
`createFixtureMcpAdapter()` for integration tests. The fixture exposes common community-style
tools:

- `mcp.filesystem.read_file`
- `mcp.filesystem.write_file`
- `mcp.web.fetch`
- `mcp.web.search`
- `mcp.artifact.write`
- `mcp.skill.create`

The sample writer skill is in `packages/example-skills/writer/SKILL.md`; its reusable report
template is in `packages/example-skills/writer/templates/report.md`.

## Workspace Safety

Every project has a `workspacePath`. The core `resolveProjectPath()` policy rejects path traversal
and prevents local filesystem tools, command execution, and artifact generation from escaping that
workspace. Command execution defaults to a 30s timeout and output truncation.

## Verification

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

The server smoke test creates a temporary project, sends a session message through the default
local runtime, verifies persisted assistant output, and downloads a generated PDF through the
artifact API.
