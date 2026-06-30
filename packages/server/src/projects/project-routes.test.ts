import { describe, expect, it } from "vitest";

import { createServerApp } from "../app";
import { createTempDataDir, createTempWorkspace } from "../test-utils";

describe("project routes", () => {
  it("opens a local workspace picker and returns the selected path", async () => {
    const app = createServerApp({
      dataDir: createTempDataDir(),
      workspacePicker: async () => "/Users/example/Desktop"
    });

    const response = await app.request("/api/workspaces/pick", {
      method: "POST"
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ workspacePath: "/Users/example/Desktop" });
  });

  it("treats a cancelled workspace picker as an empty result", async () => {
    const app = createServerApp({
      dataDir: createTempDataDir(),
      workspacePicker: async () => undefined
    });

    const response = await app.request("/api/workspaces/pick", {
      method: "POST"
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
  });

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

    await app.request("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ projectId: project.id, title: "Project chat" }),
      headers: { "content-type": "application/json" }
    });

    const deleted = await app.request(`/api/projects/${project.id}`, {
      method: "DELETE"
    });
    const listedAfterDelete = await app.request("/api/projects");
    const sessionsAfterDelete = await app.request(`/api/sessions?projectId=${project.id}`);

    expect(deleted.status).toBe(204);
    expect(await listedAfterDelete.json()).toEqual([]);
    expect(await sessionsAfterDelete.json()).toEqual([]);
  });
});
