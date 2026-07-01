import { describe, expect, it } from "vitest";

import { serverPackageName } from "./index";

describe("server package", () => {
  it("exports its package name", () => {
    expect(serverPackageName).toBe("@harness-agent/server");
  });
});
