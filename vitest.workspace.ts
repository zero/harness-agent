import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/core/vitest.config.ts",
  "packages/tools/vitest.config.ts",
  "packages/server/vitest.config.ts",
  "packages/web/vitest.config.ts",
  "packages/mcp-fixtures/vitest.config.ts"
]);
