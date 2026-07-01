import { describe, expect, it } from "vitest";

import { toolsPackageName } from "./index";

describe("tools package", () => {
  it("exports its package name", () => {
    expect(toolsPackageName).toBe("@harness-agent/tools");
  });
});
