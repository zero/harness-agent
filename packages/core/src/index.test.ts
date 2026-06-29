import { describe, expect, it } from "vitest";

import { corePackageName } from "./index";

describe("core package", () => {
  it("exports its package name", () => {
    expect(corePackageName).toBe("@harness-agent/core");
  });
});
