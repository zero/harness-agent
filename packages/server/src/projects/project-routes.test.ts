import { describe, expect, it } from "vitest";

import { createServerApp } from "../app";
import { createTempDataDir, createTempWorkspace } from "../test-utils";

describe("project routes", () => {
  it("creates, lists, updates, and deletes projects", async () => {
    const app = createServerApp({ dataDir: createTempDataDir() });
    const workspacePath = createTempWorkspace();

    const created = await app.request("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: "Local Project", workspacePath }),
      headers: { "content-type": "application/json" }
    });
    const project = await created.json();

    expect(created.status).toBe(200);
    expect(project).toMatchObject({ name: "Local Project", workspacePath });

    const listed = await app.request("/api/projects");
    expect(await listed.json()).toHaveLength(1);

    const updated = await app.request(`/api/projects/${project.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Renamed" }),
      headers: { "content-type": "application/json" }
    });
    expect(await updated.json()).toMatchObject({ name: "Renamed" });

    const deleted = await app.request(`/api/projects/${project.id}`, {
      method: "DELETE"
    });
    expect(deleted.status).toBe(204);
  });
});
