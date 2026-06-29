import { describe, expect, it } from "vitest";

import { createServerApp } from "./app";
import { createTempDataDir } from "./test-utils";

describe("server app", () => {
  it("responds to health checks", async () => {
    const app = createServerApp({ dataDir: createTempDataDir() });
    const response = await app.request("/api/health");

    expect(await response.json()).toEqual({ ok: true });
  });
});
