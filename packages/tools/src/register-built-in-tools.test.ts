import { describe, expect, it } from "vitest";

import { registerBuiltInTools } from "./register-built-in-tools";
import { ToolRegistry } from "@harness-agent/core";

describe("registerBuiltInTools", () => {
  it("registers the first-version built-in tools", () => {
    const registry = new ToolRegistry();

    registerBuiltInTools(registry);

    expect(registry.list().map((tool) => tool.id)).toEqual(
      expect.arrayContaining([
        "filesystem.read",
        "filesystem.write",
        "filesystem.list",
        "filesystem.search",
        "command.execute",
        "web.fetch",
        "web.search",
        "artifact.write",
        "skill.create"
      ])
    );
  });
});
