# Harness Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete local single-user TypeScript browser/server harness engineering agent prototype described in `docs/superpowers/specs/2026-06-29-harness-agent-design.md`.

**Architecture:** Use a `packages/`-only pnpm monorepo. `packages/core` owns pure runtime types and orchestration, `packages/tools` owns local tool implementations, `packages/server` owns local HTTP/SSE/persistence, `packages/web` owns the shadcn/Tailwind browser console, and fixture/example packages support MCP and skills tests.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, tsup, Hono, React, Vite, Tailwind CSS, shadcn-style local UI primitives, TanStack Query, react-markdown/remark/rehype, lucide-react, xlsx, docx, pptxgenjs, pdf-lib, unified artifact preview helpers.

---

## Task 1: Monorepo Foundation

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `eslint.config.js`
- Create: `vitest.workspace.ts`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/tools/package.json`
- Create: `packages/tools/tsconfig.json`
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/mcp-fixtures/package.json`
- Create: `packages/mcp-fixtures/tsconfig.json`
- Create: `packages/example-skills/writer/SKILL.md`
- Modify: `.gitignore`
- Modify: `README.md`

- [ ] **Step 1: Create workspace manifests and TypeScript config**

Create a pnpm workspace with scripts:

```json
{
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm --parallel --filter @harness-agent/server --filter @harness-agent/web dev",
    "lint": "eslint .",
    "test": "vitest run",
    "typecheck": "pnpm -r typecheck"
  }
}
```

Each package must use package names under `@harness-agent/*` and ESM output.

- [ ] **Step 2: Verify the empty workspace fails before package scripts exist**

Run: `pnpm typecheck`

Expected before implementation: failure because package manifests and TypeScript configs are missing.

- [ ] **Step 3: Implement minimal buildable package structure**

Add package-level `src/index.ts` exports for `core`, `tools`, `server`, and `mcp-fixtures`. Configure `tsup` build scripts for library packages and Vite scripts for `packages/web`.

- [ ] **Step 4: Install dependencies**

Run: `pnpm install`

Expected: lockfile created and dependencies installed.

- [ ] **Step 5: Verify workspace baseline**

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Expected: all commands exit 0 with minimal package skeleton.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json eslint.config.js vitest.workspace.ts packages README.md .gitignore
git commit -m "chore: scaffold pnpm monorepo"
```

## Task 2: Core Runtime Types, Project Policy, And Providers

**Files:**
- Create: `packages/core/src/projects/project-types.ts`
- Create: `packages/core/src/projects/project-policy.ts`
- Create: `packages/core/src/projects/project-policy.test.ts`
- Create: `packages/core/src/settings/settings-types.ts`
- Create: `packages/core/src/events/agent-events.ts`
- Create: `packages/core/src/artifacts/artifact-types.ts`
- Create: `packages/core/src/providers/provider-types.ts`
- Create: `packages/core/src/providers/openai-compatible.ts`
- Create: `packages/core/src/providers/openai-compatible.test.ts`
- Create: `packages/core/src/providers/openai.ts`
- Create: `packages/core/src/providers/openai.test.ts`
- Create: `packages/core/src/providers/anthropic.ts`
- Create: `packages/core/src/providers/anthropic.test.ts`
- Create: `packages/core/src/providers/provider-registry.ts`
- Create: `packages/core/src/providers/provider-registry.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing project policy tests**

Tests in `project-policy.test.ts` must verify:

```ts
expect(() => resolveProjectPath(project, "src/index.ts")).not.toThrow();
expect(() => resolveProjectPath(project, "../outside.txt")).toThrow("outside project workspace");
expect(isPathInsideProject(project, insidePath)).toBe(true);
expect(isPathInsideProject(project, outsidePath)).toBe(false);
```

Run: `pnpm --filter @harness-agent/core test src/projects/project-policy.test.ts`

Expected: failure because functions are not implemented.

- [ ] **Step 2: Implement project types and policy**

Implement `Project`, `ProjectContext`, `TaskSession`, `resolveProjectPath`, and `isPathInsideProject`. Use `node:path` and `node:fs` realpath checks where possible, with a fallback for paths that do not yet exist.

- [ ] **Step 3: Verify project policy tests pass**

Run: `pnpm --filter @harness-agent/core test src/projects/project-policy.test.ts`

Expected: all tests pass.

- [ ] **Step 4: Write failing provider conversion tests**

Tests must cover:

- OpenAI-compatible chat completions request body includes `model`, `messages`, and `tools`.
- DeepSeek preset uses OpenAI-compatible provider kind and `https://api.deepseek.com`.
- Anthropic request conversion maps system prompt to `system` and tools to Anthropic-style input schema.
- Registry resolves a provider by profile id and rejects missing ids.

- [ ] **Step 5: Implement provider types and adapters**

Implement pure conversion functions plus `LlmProvider` interfaces. Network calls may be implemented with injectable `fetch` so tests can use mocked responses.

- [ ] **Step 6: Verify provider tests**

Run: `pnpm --filter @harness-agent/core test src/providers`

Expected: all provider tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/core
git commit -m "feat(core): add project policy and provider adapters"
```

## Task 3: Core Tool Registry, Agent Loop, Skills, MCP, And Artifact Registry

**Files:**
- Create: `packages/core/src/tools/tool-types.ts`
- Create: `packages/core/src/tools/tool-registry.ts`
- Create: `packages/core/src/tools/tool-registry.test.ts`
- Create: `packages/core/src/agent/agent-runtime.ts`
- Create: `packages/core/src/agent/agent-runtime.test.ts`
- Create: `packages/core/src/skills/skill-registry.ts`
- Create: `packages/core/src/skills/skill-registry.test.ts`
- Create: `packages/core/src/mcp/mcp-types.ts`
- Create: `packages/core/src/mcp/mcp-registry.ts`
- Create: `packages/core/src/mcp/mcp-registry.test.ts`
- Create: `packages/core/src/artifacts/artifact-registry.ts`
- Create: `packages/core/src/artifacts/artifact-registry.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing tool registry tests**

Verify registering a tool, listing enabled tools, invoking a tool, and surfacing a normalized error when a tool id is missing.

- [ ] **Step 2: Implement `ToolRegistry`**

Use simple maps keyed by tool id. `callTool` receives `ProjectContext` and opaque input.

- [ ] **Step 3: Write failing agent runtime smoke test**

Create a fake provider that emits text, a tool call, more text, and completion. Verify `AgentRuntime.runTask()` emits `session.started`, `message.delta`, `tool.call`, `tool.result`, and `session.completed`.

- [ ] **Step 4: Implement first pragmatic agent loop**

Implement a bounded loop with `maxSteps`, event streaming, provider event normalization, and tool call execution.

- [ ] **Step 5: Write failing skill registry tests**

Use a temporary directory with `SKILL.md` frontmatter and verify metadata, instruction loading, and keyword matching.

- [ ] **Step 6: Implement skill loading**

Parse frontmatter manually or with a small dependency. Return load errors as values for UI display.

- [ ] **Step 7: Write failing MCP registry and artifact registry tests**

MCP registry tests use fake adapters. Artifact registry tests verify path metadata is stored project/session scoped.

- [ ] **Step 8: Implement MCP and artifact registries**

Keep MCP transport implementation thin in core; concrete stdio/http execution can be supplied by server. Artifact registry stores typed metadata only.

- [ ] **Step 9: Verify core**

Run:

```bash
pnpm --filter @harness-agent/core test
pnpm --filter @harness-agent/core typecheck
```

Expected: all core tests and typecheck pass.

- [ ] **Step 10: Commit**

```bash
git add packages/core
git commit -m "feat(core): add runtime registries and agent loop"
```

## Task 4: Built-In Tools And Artifact Generators

**Files:**
- Create: `packages/tools/src/filesystem/filesystem-tool.ts`
- Create: `packages/tools/src/filesystem/filesystem-tool.test.ts`
- Create: `packages/tools/src/code-execution/command-tool.ts`
- Create: `packages/tools/src/code-execution/command-tool.test.ts`
- Create: `packages/tools/src/web/web-fetch-tool.ts`
- Create: `packages/tools/src/web/web-fetch-tool.test.ts`
- Create: `packages/tools/src/web/web-search-tool.ts`
- Create: `packages/tools/src/web/web-search-tool.test.ts`
- Create: `packages/tools/src/artifacts/artifact-writers.ts`
- Create: `packages/tools/src/artifacts/artifact-writers.test.ts`
- Create: `packages/tools/src/skill-creator/skill-creator-tool.ts`
- Create: `packages/tools/src/skill-creator/skill-creator-tool.test.ts`
- Create: `packages/tools/src/register-built-in-tools.ts`
- Create: `packages/tools/src/register-built-in-tools.test.ts`
- Modify: `packages/tools/src/index.ts`

- [ ] **Step 1: Write failing filesystem safety tests**

Tests must verify read/write/list/search inside project workspace and rejection for `../outside.txt`.

- [ ] **Step 2: Implement filesystem tool**

Use `resolveProjectPath` from core. Return structured outputs and enforce response-size limits.

- [ ] **Step 3: Write failing command execution tests**

Tests must verify command success, non-zero exit reporting, timeout kill, stdout truncation, and cwd escape rejection.

- [ ] **Step 4: Implement command execution tool**

Use `node:child_process` with shell execution, timeout, cwd validation, and output truncation.

- [ ] **Step 5: Write failing web fetch/search tests**

Use a local HTTP server for fetch. Mock HTML search results for search parser tests.

- [ ] **Step 6: Implement web tools**

Implement fetch with timeout/size limits and search with SearxNG JSON plus HTML fallback parsing.

- [ ] **Step 7: Write failing artifact generation tests**

Verify generated files for markdown, HTML, CSV, XLSX, DOCX, PPTX, PDF, JSON, and text exist under `.harness-agent/artifacts/<taskId>/` and have expected mime metadata.

- [ ] **Step 8: Implement artifact writers**

Use `xlsx`, `docx`, `pptxgenjs`, and `pdf-lib`. Keep structured input small and predictable.

- [ ] **Step 9: Write failing skill creator tests**

Verify `SKILL.md`, `scripts/`, `templates/`, and `assets/` are created under the project workspace.

- [ ] **Step 10: Implement skill creator and built-in registration**

Expose all built-in tools through `registerBuiltInTools(settings)`.

- [ ] **Step 11: Verify tools**

Run:

```bash
pnpm --filter @harness-agent/tools test
pnpm --filter @harness-agent/tools typecheck
```

Expected: all tool tests and typecheck pass.

- [ ] **Step 12: Commit**

```bash
git add packages/tools
git commit -m "feat(tools): add local tools and artifact generators"
```

## Task 5: Server API, Persistence, SSE, And Preview Routes

**Files:**
- Create: `packages/server/src/config/default-settings.ts`
- Create: `packages/server/src/storage/json-store.ts`
- Create: `packages/server/src/storage/json-store.test.ts`
- Create: `packages/server/src/projects/project-routes.ts`
- Create: `packages/server/src/projects/project-routes.test.ts`
- Create: `packages/server/src/settings/settings-routes.ts`
- Create: `packages/server/src/settings/settings-routes.test.ts`
- Create: `packages/server/src/sessions/session-store.ts`
- Create: `packages/server/src/sessions/session-store.test.ts`
- Create: `packages/server/src/sessions/session-routes.ts`
- Create: `packages/server/src/sessions/session-routes.test.ts`
- Create: `packages/server/src/artifacts/artifact-routes.ts`
- Create: `packages/server/src/artifacts/artifact-routes.test.ts`
- Create: `packages/server/src/app.ts`
- Create: `packages/server/src/app.test.ts`
- Create: `packages/server/src/index.ts`

- [ ] **Step 1: Write failing storage and project route tests**

Use Hono request tests to verify create/list/update/delete projects and path persistence.

- [ ] **Step 2: Implement JSON storage and project routes**

Persist under `.harness-agent-local` by default, with an injectable data directory for tests.

- [ ] **Step 3: Write failing settings tests**

Verify defaults include built-in tool ids, DeepSeek preset, and empty enabled MCP/skill paths.

- [ ] **Step 4: Implement settings routes**

Expose `GET /api/settings`, `PUT /api/settings`, provider test, and MCP test endpoints.

- [ ] **Step 5: Write failing session/SSE tests**

Use a fake runtime to verify session creation and event streaming of at least two events.

- [ ] **Step 6: Implement session routes**

Wire runtime, stores, and SSE. Support cancellation by session id with `AbortController`.

- [ ] **Step 7: Write failing artifact route tests**

Verify download and preview routes reject artifacts outside the owning project workspace.

- [ ] **Step 8: Implement artifact routes and previews**

Return browser-friendly preview JSON/HTML where possible and file responses for raw downloads.

- [ ] **Step 9: Verify server**

Run:

```bash
pnpm --filter @harness-agent/server test
pnpm --filter @harness-agent/server typecheck
```

Expected: all server tests and typecheck pass.

- [ ] **Step 10: Commit**

```bash
git add packages/server
git commit -m "feat(server): add local API and session streaming"
```

## Task 6: Web Console With shadcn/Tailwind Styling

**Files:**
- Create: `packages/web/index.html`
- Create: `packages/web/vite.config.ts`
- Create: `packages/web/tailwind.config.ts`
- Create: `packages/web/postcss.config.js`
- Create: `packages/web/components.json`
- Create: `packages/web/src/main.tsx`
- Create: `packages/web/src/app/app.tsx`
- Create: `packages/web/src/app/app.test.tsx`
- Create: `packages/web/src/app/routes.ts`
- Create: `packages/web/src/lib/api-client.ts`
- Create: `packages/web/src/lib/api-client.test.ts`
- Create: `packages/web/src/lib/sse.ts`
- Create: `packages/web/src/lib/sse.test.ts`
- Create: `packages/web/src/lib/utils.ts`
- Create: `packages/web/src/styles/globals.css`
- Create: `packages/web/src/components/ui/button.tsx`
- Create: `packages/web/src/components/ui/card.tsx`
- Create: `packages/web/src/components/ui/input.tsx`
- Create: `packages/web/src/components/ui/tabs.tsx`
- Create: `packages/web/src/components/ui/dialog.tsx`
- Create: `packages/web/src/components/ui/scroll-area.tsx`
- Create: `packages/web/src/components/ui/switch.tsx`
- Create: `packages/web/src/components/ui/textarea.tsx`
- Create: `packages/web/src/features/projects/projects-page.tsx`
- Create: `packages/web/src/features/projects/projects-page.test.tsx`
- Create: `packages/web/src/features/workspace/workspace-page.tsx`
- Create: `packages/web/src/features/workspace/workspace-page.test.tsx`
- Create: `packages/web/src/features/settings/settings-page.tsx`
- Create: `packages/web/src/features/settings/settings-page.test.tsx`
- Create: `packages/web/src/features/runs/runs-page.tsx`
- Create: `packages/web/src/features/artifacts/artifacts-page.tsx`

- [ ] **Step 1: Initialize Vite React and Tailwind/shadcn-style primitives**

Use local source components compatible with shadcn composition. Avoid generated marketing layout. Use lucide icons in icon buttons.

- [ ] **Step 2: Write failing API client and SSE tests**

Verify API paths, JSON parsing, and SSE event parsing.

- [ ] **Step 3: Implement API client and SSE helper**

Use typed helpers and keep components free of raw fetch calls.

- [ ] **Step 4: Write failing Projects page tests**

Verify project list rendering, create form, workspace path field, and open project action.

- [ ] **Step 5: Implement Projects page**

Build compact operational UI with shadcn-style Card, Button, Input, and Dialog primitives.

- [ ] **Step 6: Write failing Workspace page tests**

Verify conversation stream rendering, Markdown message rendering container, collapsed tool calls, artifact cards, and right-side panel tabs.

- [ ] **Step 7: Implement Workspace page**

Use a three-panel layout: sessions, conversation, and artifacts/files/events. Keep text inside containers at desktop and mobile widths.

- [ ] **Step 8: Write failing Settings page tests**

Verify provider profile fields, built-in tool switches, MCP form, skill path form, and safety fields.

- [ ] **Step 9: Implement Settings page**

Use tabs for Providers, Tools, MCP, Skills, and Safety.

- [ ] **Step 10: Verify web**

Run:

```bash
pnpm --filter @harness-agent/web test
pnpm --filter @harness-agent/web typecheck
pnpm --filter @harness-agent/web build
```

Expected: web tests, typecheck, and production build pass.

- [ ] **Step 11: Commit**

```bash
git add packages/web
git commit -m "feat(web): add local agent console"
```

## Task 7: Markdown And Artifact Preview Experience

**Files:**
- Create: `packages/web/src/features/markdown/markdown-renderer.tsx`
- Create: `packages/web/src/features/markdown/markdown-renderer.test.tsx`
- Create: `packages/web/src/features/artifacts/artifact-preview.tsx`
- Create: `packages/web/src/features/artifacts/artifact-preview.test.tsx`
- Create: `packages/web/src/features/artifacts/artifact-card.tsx`
- Create: `packages/web/src/features/artifacts/artifact-card.test.tsx`
- Modify: `packages/web/src/features/workspace/workspace-page.tsx`
- Modify: `packages/web/src/features/artifacts/artifacts-page.tsx`

- [ ] **Step 1: Write failing Markdown renderer tests**

Verify headings, links, GFM tables, task lists, code fences, Mermaid fences, math, and HTML sanitization.

- [ ] **Step 2: Implement Markdown renderer**

Use `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, and `rehype-sanitize`. Render Mermaid fences as safe diagram blocks without executing arbitrary scripts.

- [ ] **Step 3: Write failing artifact preview tests**

Verify preview behavior for markdown, HTML, CSV, XLSX, DOCX, PPTX, PDF, JSON, text, and image preview metadata.

- [ ] **Step 4: Implement artifact previews**

Render HTML in sandboxed iframe, tabular data in tables, PDF/image with browser-native embeds, and office files with extracted preview metadata plus download action.

- [ ] **Step 5: Integrate previews into Workspace and Artifacts pages**

Inline artifact cards in conversation and full preview in right-side panel.

- [ ] **Step 6: Verify artifact UI**

Run:

```bash
pnpm --filter @harness-agent/web test src/features/markdown src/features/artifacts
pnpm --filter @harness-agent/web build
```

Expected: tests and build pass.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/features/markdown packages/web/src/features/artifacts packages/web/src/features/workspace
git commit -m "feat(web): add markdown and artifact previews"
```

## Task 8: MCP Fixtures, Example Skills, End-To-End Smoke, And Documentation

**Files:**
- Create: `packages/mcp-fixtures/src/fixture-server.ts`
- Create: `packages/mcp-fixtures/src/fixture-server.test.ts`
- Create: `packages/server/src/integration/local-agent-smoke.test.ts`
- Modify: `packages/example-skills/writer/SKILL.md`
- Create: `packages/example-skills/writer/templates/report.md`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-06-29-harness-agent-design.md` only if implementation reveals a harmless clarification needed.

- [ ] **Step 1: Write failing MCP fixture tests**

Verify fixture server lists filesystem, web, artifact, and skill-creator tools and returns deterministic responses.

- [ ] **Step 2: Implement MCP fixture server**

Provide a simple JSON-RPC-compatible test fixture usable by core/server integration tests.

- [ ] **Step 3: Write failing local agent smoke test**

Create a temp project, fake provider, enabled built-in tools, and session request. Verify a task can produce a streamed response plus a markdown artifact under the project workspace.

- [ ] **Step 4: Implement smoke path wiring**

Connect server runtime construction to core runtime and built-in tools.

- [ ] **Step 5: Update README**

Document setup, dev, test, build, provider profiles, DeepSeek preset, project workspace safety, MCP fixtures, skills, and artifact preview support.

- [ ] **Step 6: Run full verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all commands exit 0.

- [ ] **Step 7: Start local dev server for manual handoff**

Run:

```bash
pnpm dev
```

Expected: server and web dev processes start and print local URLs. Keep the process running only long enough to capture the URL and confirm the UI loads, then stop it before final reporting unless the user asks to keep it running.

- [ ] **Step 8: Commit**

```bash
git add packages/mcp-fixtures packages/server packages/example-skills README.md docs
git commit -m "test: add fixtures and local smoke coverage"
```

## Final Verification Checklist

- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm lint` exits 0.
- [ ] `pnpm build` exits 0.
- [ ] A project can be created with a workspace path.
- [ ] Built-in tool enablement is global.
- [ ] Filesystem and command tools reject paths outside the project workspace.
- [ ] OpenAI, Anthropic, and OpenAI-compatible provider conversions are tested.
- [ ] DeepSeek appears as an OpenAI-compatible preset.
- [ ] MCP fixture tools can be listed and called.
- [ ] Skill paths can be scanned and the skill creator writes a valid skeleton.
- [ ] Chat UI renders Markdown, tool calls, and artifact cards.
- [ ] Artifact previews cover markdown, HTML, CSV, XLSX, DOCX, PPTX, PDF, JSON, text, and image.
- [ ] Server and web dev URLs are reported.
