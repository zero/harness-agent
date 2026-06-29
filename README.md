# harness-agent

A local, single-user TypeScript browser/server harness engineering agent prototype.

The project is organized as a `packages/`-only pnpm monorepo:

- `packages/core` contains provider adapters, agent runtime primitives, project policy, MCP, skills, and artifact types.
- `packages/tools` contains local filesystem, command execution, web, artifact generation, and skill creator tools.
- `packages/server` exposes the local Hono API and SSE task stream.
- `packages/web` contains the React, Tailwind CSS, and shadcn-style browser console.
- `packages/mcp-fixtures` and `packages/example-skills` provide integration fixtures.

## Development

```bash
pnpm install
pnpm dev
```

## Verification

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```
