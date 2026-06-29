import { describe, expect, it } from "vitest";

import { mcpFixturesPackageName } from "./index";

describe("mcp fixtures package", () => {
  it("exports its package name", () => {
    expect(mcpFixturesPackageName).toBe("@harness-agent/mcp-fixtures");
  });
});
