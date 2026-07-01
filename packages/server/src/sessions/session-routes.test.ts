import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createServerApp } from "../app";
import { createTempDataDir, createTempWorkspace } from "../test-utils";
import type { AgentEvent } from "@harness-agent/core";

describe("session routes", () => {
  it("uses workspace filesystem context before calling a live provider for directory questions", async () => {
    const providerCalls: { url: string; init?: RequestInit }[] = [];
    const app = createServerApp({
      dataDir: createTempDataDir(),
      env: {},
      fetchImpl: async (input, init) => {
        providerCalls.push({ url: String(input), init });
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "我看到了 notes.txt。"
                }
              }
            ]
          }),
          { headers: { "content-type": "application/json" } }
        );
      }
    });
    const currentSettings = await (await app.request("/api/settings")).json();
    await app.request("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        ...currentSettings,
        providerProfiles: [
          {
            id: "doubao",
            name: "Doubao",
            kind: "openai-compatible",
            baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
            apiKeyEnv: "direct-test-key-123456",
            model: "doubao-seed"
          }
        ],
        enabledToolIds: ["filesystem.list"]
      }),
      headers: { "content-type": "application/json" }
    });
    const workspacePath = createTempWorkspace();
    writeFileSync(`${workspacePath}/notes.txt`, "desktop note");
    const project = await (
      await app.request("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Desktop", workspacePath }),
        headers: { "content-type": "application/json" }
      })
    ).json();
    const session = await (
      await app.request("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          title: "List desktop",
          providerProfileId: "doubao"
        }),
        headers: { "content-type": "application/json" }
      })
    ).json();

    const messageResponse = await app.request(`/api/sessions/${session.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "当前目录有哪些文件？" }),
      headers: { "content-type": "application/json" }
    });
    const eventsResponse = await app.request(`/api/sessions/${session.id}/events.json`);

    expect(messageResponse.status).toBe(200);
    expect(eventsResponse.status).toBe(200);
    const events = await eventsResponse.json();
    expect(providerCalls).toHaveLength(1);
    expect(JSON.parse(String(providerCalls[0]?.init?.body))).toMatchObject({
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("notes.txt")
        })
      ])
    });
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "tool.call", toolName: "filesystem.list" }),
        expect.objectContaining({ type: "tool.result", toolName: "filesystem.list" })
      ])
    );
  });

  it("emits skill match events and sends enabled skill instructions to the provider", async () => {
    const providerBodies: unknown[] = [];
    const app = createServerApp({
      dataDir: createTempDataDir(),
      env: {},
      fetchImpl: async (_input, init) => {
        providerBodies.push(JSON.parse(String(init?.body)));
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "我会按 writer skill 组织报告。"
                }
              }
            ]
          }),
          { headers: { "content-type": "application/json" } }
        );
      }
    });
    const currentSettings = await (await app.request("/api/settings")).json();
    await app.request("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        ...currentSettings,
        providerProfiles: [
          {
            id: "doubao",
            name: "Doubao",
            kind: "openai-compatible",
            baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
            apiKeyEnv: "direct-test-key-123456",
            model: "doubao-seed"
          }
        ]
      }),
      headers: { "content-type": "application/json" }
    });
    const workspacePath = createTempWorkspace();
    const project = await (
      await app.request("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Local Project", workspacePath }),
        headers: { "content-type": "application/json" }
      })
    ).json();
    const session = await (
      await app.request("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          title: "Draft report",
          providerProfileId: "doubao"
        }),
        headers: { "content-type": "application/json" }
      })
    ).json();

    const messageResponse = await app.request(`/api/sessions/${session.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "帮我生成一个 report artifact" }),
      headers: { "content-type": "application/json" }
    });
    const events = await (await app.request(`/api/sessions/${session.id}/events.json`)).json();

    expect(messageResponse.status).toBe(200);
    expect(events).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "skill.match", skillName: "writer" })])
    );
    expect(providerBodies[0]).toMatchObject({
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("Enabled skill matched: writer")
        })
      ])
    });
  });

  it("uses the selected OpenAI-compatible provider for chat replies", async () => {
    const providerCalls: { url: string; init?: RequestInit }[] = [];
    const app = createServerApp({
      dataDir: createTempDataDir(),
      env: {},
      fetchImpl: async (input, init) => {
        providerCalls.push({ url: String(input), init });
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "我是豆包 provider 的真实对话回复。"
                }
              }
            ]
          }),
          { headers: { "content-type": "application/json" } }
        );
      }
    });
    const currentSettings = await (await app.request("/api/settings")).json();
    await app.request("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        ...currentSettings,
        providerProfiles: [
          {
            id: "doubao",
            name: "Doubao",
            kind: "openai-compatible",
            baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
            apiKeyEnv: "direct-test-key-123456",
            model: "doubao-seed"
          }
        ]
      }),
      headers: { "content-type": "application/json" }
    });
    const workspacePath = createTempWorkspace();
    const project = await (
      await app.request("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Local Project", workspacePath }),
        headers: { "content-type": "application/json" }
      })
    ).json();
    const session = await (
      await app.request("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          title: "Ask provider",
          providerProfileId: "doubao"
        }),
        headers: { "content-type": "application/json" }
      })
    ).json();

    const messageResponse = await app.request(`/api/sessions/${session.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "你是谁？" }),
      headers: { "content-type": "application/json" }
    });
    const updatedSession = await (await app.request(`/api/sessions/${session.id}`)).json();

    expect(messageResponse.status).toBe(200);
    expect(providerCalls).toHaveLength(1);
    expect(providerCalls[0]?.url).toBe("https://ark.cn-beijing.volces.com/api/v3/chat/completions");
    expect(providerCalls[0]?.init?.headers).toMatchObject({
      authorization: "Bearer direct-test-key-123456"
    });
    expect(JSON.parse(String(providerCalls[0]?.init?.body))).toMatchObject({
      model: "doubao-seed",
      messages: expect.arrayContaining([{ role: "user", content: "你是谁？" }])
    });
    expect(updatedSession).toMatchObject({
      status: "completed",
      providerProfileId: "doubao",
      artifactIds: []
    });
    expect(updatedSession.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: "我是豆包 provider 的真实对话回复。"
        })
      ])
    );
  });

  it("turns provider-generated HTML code blocks into previewable artifacts", async () => {
    const app = createServerApp({
      dataDir: createTempDataDir(),
      env: {},
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: [
                    "我已生成 HTML 报告。",
                    "",
                    "```html",
                    "<!doctype html><html><body><h1>Revenue Report</h1></body></html>",
                    "```"
                  ].join("\n")
                }
              }
            ]
          }),
          { headers: { "content-type": "application/json" } }
        )
    });
    const currentSettings = await (await app.request("/api/settings")).json();
    await app.request("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        ...currentSettings,
        providerProfiles: [
          {
            id: "doubao",
            name: "Doubao",
            kind: "openai-compatible",
            baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
            apiKeyEnv: "direct-test-key-123456",
            model: "doubao-seed"
          }
        ],
        enabledToolIds: ["artifact.write"]
      }),
      headers: { "content-type": "application/json" }
    });
    const workspacePath = createTempWorkspace();
    const project = await (
      await app.request("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Report Project", workspacePath }),
        headers: { "content-type": "application/json" }
      })
    ).json();
    const session = await (
      await app.request("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          title: "HTML report",
          providerProfileId: "doubao"
        }),
        headers: { "content-type": "application/json" }
      })
    ).json();

    const messageResponse = await app.request(`/api/sessions/${session.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "生成一个 HTML 报告 artifact" }),
      headers: { "content-type": "application/json" }
    });
    const updatedSession = await (await app.request(`/api/sessions/${session.id}`)).json();
    const events = await (await app.request(`/api/sessions/${session.id}/events.json`)).json();
    const artifacts = await (await app.request(`/api/artifacts?sessionId=${session.id}`)).json();
    const htmlArtifact = artifacts.find((artifact: { kind: string }) => artifact.kind === "html");
    const preview = await (
      await app.request(`/api/artifacts/${htmlArtifact.id}/preview`)
    ).json();
    const download = await (await app.request(`/api/artifacts/${htmlArtifact.id}`)).text();

    expect(messageResponse.status).toBe(200);
    expect(htmlArtifact).toMatchObject({
      kind: "html",
      title: "HTML Report"
    });
    expect(updatedSession.artifactIds).toContain(htmlArtifact.id);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "tool.call", toolName: "artifact.write" }),
        expect.objectContaining({ type: "artifact.created", artifact: expect.objectContaining({ kind: "html" }) })
      ])
    );
    expect(preview).toMatchObject({
      kind: "html",
      content: expect.stringContaining("<h1>Revenue Report</h1>")
    });
    expect(download).toBe("<!doctype html><html><body><h1>Revenue Report</h1></body></html>");
    expect(updatedSession.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: expect.stringContaining("已生成 HTML artifact")
        })
      ])
    );
  });

  it("materializes truncated provider HTML fences instead of leaving HTML in markdown", async () => {
    const providerBodies: unknown[] = [];
    const app = createServerApp({
      dataDir: createTempDataDir(),
      env: {},
      fetchImpl: async (_input, init) => {
        providerBodies.push(JSON.parse(String(init?.body)));
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: [
                    "下面是 HTML 报告：",
                    "```html",
                    "<!doctype html>",
                    "<html><body><h1>Truncated Report</h1>"
                  ].join("\n")
                }
              }
            ]
          }),
          { headers: { "content-type": "application/json" } }
        );
      }
    });
    const currentSettings = await (await app.request("/api/settings")).json();
    await app.request("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        ...currentSettings,
        providerProfiles: [
          {
            id: "doubao",
            name: "Doubao",
            kind: "openai-compatible",
            baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
            apiKeyEnv: "direct-test-key-123456",
            model: "doubao-seed"
          }
        ],
        enabledToolIds: ["artifact.write"]
      }),
      headers: { "content-type": "application/json" }
    });
    const workspacePath = createTempWorkspace();
    const project = await (
      await app.request("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Truncated Report Project", workspacePath }),
        headers: { "content-type": "application/json" }
      })
    ).json();
    const session = await (
      await app.request("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          title: "Truncated HTML report",
          providerProfileId: "doubao"
        }),
        headers: { "content-type": "application/json" }
      })
    ).json();

    const messageResponse = await app.request(`/api/sessions/${session.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "根据论文内容写一个 html 分析报告" }),
      headers: { "content-type": "application/json" }
    });
    const updatedSession = await (await app.request(`/api/sessions/${session.id}`)).json();
    const artifacts = await (await app.request(`/api/artifacts?sessionId=${session.id}`)).json();
    const htmlArtifact = artifacts.find((artifact: { kind: string }) => artifact.kind === "html");
    const preview = await (
      await app.request(`/api/artifacts/${htmlArtifact.id}/preview`)
    ).json();

    expect(messageResponse.status).toBe(200);
    expect(providerBodies[0]).toMatchObject({ max_tokens: 8192 });
    expect(htmlArtifact).toMatchObject({ kind: "html", title: "HTML Report" });
    expect(preview).toMatchObject({
      kind: "html",
      content: expect.stringContaining("<h1>Truncated Report</h1>")
    });
    expect(updatedSession.messages.at(-1).content).toContain("已生成 HTML artifact");
    expect(updatedSession.messages.at(-1).content).not.toContain("<!doctype html>");
  });

  it("writes and executes a Node.js script inside the selected project", async () => {
    const app = createServerApp({ dataDir: createTempDataDir() });
    const workspacePath = createTempWorkspace();
    writeFileSync(join(workspacePath, "input.txt"), "hello");
    const project = await (
      await app.request("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Script Project", workspacePath }),
        headers: { "content-type": "application/json" }
      })
    ).json();
    const session = await (
      await app.request("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          title: "Run Node script"
        }),
        headers: { "content-type": "application/json" }
      })
    ).json();

    const messageResponse = await app.request(`/api/sessions/${session.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "写一个 nodejs 脚本列出当前目录文件并执行" }),
      headers: { "content-type": "application/json" }
    });
    const updatedSession = await (await app.request(`/api/sessions/${session.id}`)).json();
    const events = await (await app.request(`/api/sessions/${session.id}/events.json`)).json();
    const scriptPath = join(workspacePath, ".harness-agent/scripts", session.id, "script.js");

    expect(messageResponse.status).toBe(200);
    expect(existsSync(scriptPath)).toBe(true);
    expect(readFileSync(scriptPath, "utf8")).toContain("readdirSync");
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "tool.call", toolName: "filesystem.write" }),
        expect.objectContaining({ type: "tool.call", toolName: "command.execute" }),
        expect.objectContaining({
          type: "tool.result",
          toolName: "command.execute",
          output: expect.objectContaining({
            exitCode: 0,
            stdout: expect.stringContaining("input.txt")
          })
        })
      ])
    );
    expect(updatedSession.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: expect.stringContaining("input.txt")
        })
      ])
    );
  });

  it("executes an explicit shell command inside the selected project", async () => {
    const app = createServerApp({ dataDir: createTempDataDir() });
    const workspacePath = createTempWorkspace();
    writeFileSync(join(workspacePath, "input.txt"), "hello");
    const project = await (
      await app.request("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Shell Project", workspacePath }),
        headers: { "content-type": "application/json" }
      })
    ).json();
    const session = await (
      await app.request("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          title: "Run shell"
        }),
        headers: { "content-type": "application/json" }
      })
    ).json();

    const messageResponse = await app.request(`/api/sessions/${session.id}/messages`, {
      method: "POST",
      body: JSON.stringify({
        content: "请执行 shell 指令 `printf 'files:' && ls`，并告诉我输出"
      }),
      headers: { "content-type": "application/json" }
    });
    const updatedSession = await (await app.request(`/api/sessions/${session.id}`)).json();
    const events = await (await app.request(`/api/sessions/${session.id}/events.json`)).json();

    expect(messageResponse.status).toBe(200);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "tool.call",
          toolName: "command.execute",
          input: expect.objectContaining({ command: "printf 'files:' && ls" })
        }),
        expect.objectContaining({
          type: "tool.result",
          toolName: "command.execute",
          output: expect.objectContaining({
            exitCode: 0,
            stdout: expect.stringContaining("input.txt")
          })
        })
      ])
    );
    expect(updatedSession.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: expect.stringContaining("input.txt")
        })
      ])
    );
  });

  it("writes and executes provider-generated Node.js code inside the selected project", async () => {
    const app = createServerApp({
      dataDir: createTempDataDir(),
      env: {},
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: [
                    "下面是脚本：",
                    "```js",
                    'const { readFileSync } = require("node:fs");',
                    'console.log(`VALUE:${readFileSync("input.txt", "utf8")}`);',
                    "```"
                  ].join("\n")
                }
              }
            ]
          }),
          { headers: { "content-type": "application/json" } }
        )
    });
    const currentSettings = await (await app.request("/api/settings")).json();
    await app.request("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        ...currentSettings,
        providerProfiles: [
          {
            id: "doubao",
            name: "Doubao",
            kind: "openai-compatible",
            baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
            apiKeyEnv: "direct-test-key-123456",
            model: "doubao-seed"
          }
        ],
        enabledToolIds: ["filesystem.write", "command.execute"]
      }),
      headers: { "content-type": "application/json" }
    });
    const workspacePath = createTempWorkspace();
    writeFileSync(join(workspacePath, "input.txt"), "hello");
    const project = await (
      await app.request("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Generated Script Project", workspacePath }),
        headers: { "content-type": "application/json" }
      })
    ).json();
    const session = await (
      await app.request("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          title: "Provider script",
          providerProfileId: "doubao"
        }),
        headers: { "content-type": "application/json" }
      })
    ).json();

    const messageResponse = await app.request(`/api/sessions/${session.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "生成并执行 nodejs 脚本读取 input.txt" }),
      headers: { "content-type": "application/json" }
    });
    const updatedSession = await (await app.request(`/api/sessions/${session.id}`)).json();
    const events = await (await app.request(`/api/sessions/${session.id}/events.json`)).json();
    const scriptPath = join(workspacePath, ".harness-agent/scripts", session.id, "script.js");

    expect(messageResponse.status).toBe(200);
    expect(readFileSync(scriptPath, "utf8")).toContain("VALUE:");
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "tool.call", toolName: "filesystem.write" }),
        expect.objectContaining({
          type: "tool.result",
          toolName: "command.execute",
          output: expect.objectContaining({
            exitCode: 0,
            stdout: expect.stringContaining("VALUE:hello")
          })
        })
      ])
    );
    expect(updatedSession.messages.at(-1).content).toContain("VALUE:hello");
    expect(updatedSession.messages.at(-1).content).not.toContain("```js");
  });

  it("lets the provider author a Node.js analysis script and materializes script-generated artifacts", async () => {
    const providerCalls: unknown[] = [];
    const app = createServerApp({
      dataDir: createTempDataDir(),
      env: {},
      fetchImpl: async (_input, init) => {
        providerCalls.push(init?.body);
        const script = [
          'const { readdirSync, readFileSync } = require("node:fs");',
          'const { join } = require("node:path");',
          'const skip = new Set([".git", "node_modules", ".harness-agent"]);',
          'const fields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];',
          "const packages = [];",
          "function walk(dir) {",
          "  for (const entry of readdirSync(dir, { withFileTypes: true })) {",
          "    if (entry.isDirectory()) {",
          "      if (!skip.has(entry.name)) walk(join(dir, entry.name));",
          "    } else if (entry.isFile() && entry.name === 'package.json') {",
          "      packages.push(join(dir, entry.name));",
          "    }",
          "  }",
          "}",
          "walk(process.cwd());",
          "const counts = new Map();",
          "for (const file of packages) {",
          "  const pkg = JSON.parse(readFileSync(file, 'utf8'));",
          "  const names = new Set();",
          "  for (const field of fields) {",
          "    for (const name of Object.keys(pkg[field] || {})) names.add(name);",
          "  }",
          "  for (const name of names) counts.set(name, (counts.get(name) || 0) + 1);",
          "}",
          "const data = [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));",
          "const html = `<!doctype html><html><head><title>NPM Dependency Usage Report</title><script src=\"https://cdn.jsdelivr.net/npm/d3@7\"></script></head><body><h1>NPM Dependency Usage Report</h1><svg id=\"chart\"></svg><script>const data=${JSON.stringify(data)};d3.select('#chart').selectAll('text').data(data).join('text').attr('x',10).attr('y',(_,i)=>20+i*20).text(d=>d.name + ': ' + d.count);</script></body></html>`;",
          "console.log(`DEPENDENCY_COUNT:${data.length}`);",
          "console.log('HARNESS_ARTIFACT_JSON:' + JSON.stringify({ kind: 'html', title: 'NPM Dependency D3 Report', content: html }));"
        ].join("\n");
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: ["我会写一个 Node.js 脚本完成统计并输出报告 artifact。", "```js", script, "```"].join("\n")
                }
              }
            ]
          }),
          { headers: { "content-type": "application/json" } }
        );
      }
    });
    const currentSettings = await (await app.request("/api/settings")).json();
    await app.request("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        ...currentSettings,
        providerProfiles: [
          {
            id: "doubao",
            name: "Doubao",
            kind: "openai-compatible",
            baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
            apiKeyEnv: "direct-test-key-123456",
            model: "doubao-seed"
          }
        ],
        enabledToolIds: ["filesystem.write", "command.execute", "artifact.write"]
      }),
      headers: { "content-type": "application/json" }
    });
    const workspacePath = createTempWorkspace();
    mkdirSync(join(workspacePath, "repo-a", ".git"), { recursive: true });
    mkdirSync(join(workspacePath, "repo-b", ".git"), { recursive: true });
    writeFileSync(
      join(workspacePath, "repo-a", "package.json"),
      JSON.stringify({
        dependencies: { react: "^19.0.0", lodash: "^4.17.21" },
        devDependencies: { vite: "^7.0.0" }
      })
    );
    writeFileSync(
      join(workspacePath, "repo-b", "package.json"),
      JSON.stringify({
        dependencies: { react: "^18.0.0", axios: "^1.0.0" },
        devDependencies: { vite: "^6.0.0" }
      })
    );
    const project = await (
      await app.request("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Dependency Report Project", workspacePath }),
        headers: { "content-type": "application/json" }
      })
    ).json();
    const session = await (
      await app.request("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          title: "NPM dependency report",
          providerProfileId: "doubao"
        }),
        headers: { "content-type": "application/json" }
      })
    ).json();

    const messageResponse = await app.request(`/api/sessions/${session.id}/messages`, {
      method: "POST",
      body: JSON.stringify({
        content:
          "写个 nodejs 脚本，统计当前目录所有代码仓库使用的三方依赖库（npm），按照出现次数（不需要分版本）统计，然后写一个 artifact html，用 d3 可视化绘制出来做成一个报告"
      }),
      headers: { "content-type": "application/json" }
    });
    const updatedSession = await (await app.request(`/api/sessions/${session.id}`)).json();
    const events = await (await app.request(`/api/sessions/${session.id}/events.json`)).json();
    const artifacts = await (await app.request(`/api/artifacts?sessionId=${session.id}`)).json();
    const htmlArtifact = artifacts.find((artifact: { kind: string }) => artifact.kind === "html");
    const preview = await (
      await app.request(`/api/artifacts/${htmlArtifact.id}/preview`)
    ).json();
    const scriptPath = join(workspacePath, ".harness-agent/scripts", session.id, "script.js");

    expect(messageResponse.status).toBe(200);
    expect(providerCalls).toHaveLength(1);
    expect(existsSync(scriptPath)).toBe(true);
    expect(readFileSync(scriptPath, "utf8")).toContain("package.json");
    expect(readFileSync(scriptPath, "utf8")).toContain("dependencies");
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "tool.call", toolName: "filesystem.write" }),
        expect.objectContaining({
          type: "tool.result",
          toolName: "command.execute",
          output: expect.objectContaining({
            exitCode: 0,
            stdout: expect.stringContaining("DEPENDENCY_COUNT:4")
          })
        }),
        expect.objectContaining({
          type: "tool.call",
          toolName: "artifact.write",
          input: expect.objectContaining({ kind: "html" })
        }),
        expect.objectContaining({
          type: "artifact.created",
          artifact: expect.objectContaining({ kind: "html" })
        })
      ])
    );
    expect(events).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "thinking",
          summary: expect.stringContaining("local repository count")
        })
      ])
    );
    expect(htmlArtifact).toMatchObject({ kind: "html", title: "NPM Dependency D3 Report" });
    expect(preview).toMatchObject({
      kind: "html",
      content: expect.stringContaining("NPM Dependency Usage Report")
    });
    expect(preview.content).toContain("https://cdn.jsdelivr.net/npm/d3@7");
    expect(preview.content).toContain('"react","count":2');
    expect(preview.content).toContain('"vite","count":2');
    expect(updatedSession.artifactIds).toContain(htmlArtifact.id);
    expect(updatedSession.messages.at(-1).content).toContain("DEPENDENCY_COUNT:4");
    expect(updatedSession.messages.at(-1).content).toContain("已生成 HTML artifact");
    expect(updatedSession.messages.at(-1).content).not.toContain("HARNESS_ARTIFACT_JSON");
    expect(updatedSession.messages.at(-1).content).not.toContain("Git 代码库");
  });

  it("registers artifact files that a provider-authored Node.js script writes directly", async () => {
    const app = createServerApp({
      dataDir: createTempDataDir(),
      env: {},
      fetchImpl: async () => {
        const script = [
          'const { writeFileSync } = require("node:fs");',
          "const html = '<!doctype html><html><body><h1>NPM Dependency Usage Report</h1></body></html>';",
          "writeFileSync('npm-deps-report.html', html);",
          "console.log('✅ 统计完成，报告已生成：npm-deps-report.html');"
        ].join("\n");
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: ["我会写脚本并生成 HTML 报告文件。", "```js", script, "```"].join("\n")
                }
              }
            ]
          }),
          { headers: { "content-type": "application/json" } }
        );
      }
    });
    const currentSettings = await (await app.request("/api/settings")).json();
    await app.request("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        ...currentSettings,
        providerProfiles: [
          {
            id: "doubao",
            name: "Doubao",
            kind: "openai-compatible",
            baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
            apiKeyEnv: "direct-test-key-123456",
            model: "doubao-seed"
          }
        ],
        enabledToolIds: ["filesystem.write", "command.execute", "artifact.write"]
      }),
      headers: { "content-type": "application/json" }
    });
    const workspacePath = createTempWorkspace();
    const project = await (
      await app.request("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Direct HTML Project", workspacePath }),
        headers: { "content-type": "application/json" }
      })
    ).json();
    const session = await (
      await app.request("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          title: "Direct HTML artifact",
          providerProfileId: "doubao"
        }),
        headers: { "content-type": "application/json" }
      })
    ).json();

    const messageResponse = await app.request(`/api/sessions/${session.id}/messages`, {
      method: "POST",
      body: JSON.stringify({
        content:
          "写个 nodejs 脚本，统计当前目录所有代码仓库使用的三方依赖库（npm），按照出现次数（不需要分版本）统计，然后写一个 artifact html，用 d3 可视化绘制出来做成一个报告"
      }),
      headers: { "content-type": "application/json" }
    });
    const updatedSession = await (await app.request(`/api/sessions/${session.id}`)).json();
    const events = await (await app.request(`/api/sessions/${session.id}/events.json`)).json();
    const artifacts = await (await app.request(`/api/artifacts?sessionId=${session.id}`)).json();
    const htmlArtifact = artifacts.find((artifact: { relativePath: string }) =>
      artifact.relativePath.endsWith("npm-deps-report.html")
    );
    const preview = await (
      await app.request(`/api/artifacts/${htmlArtifact.id}/preview`)
    ).json();

    expect(messageResponse.status).toBe(200);
    expect(htmlArtifact).toMatchObject({
      kind: "html",
      title: "npm-deps-report.html",
      relativePath: "npm-deps-report.html"
    });
    expect(preview).toMatchObject({
      kind: "html",
      content: expect.stringContaining("NPM Dependency Usage Report")
    });
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "artifact.created",
          artifact: expect.objectContaining({
            kind: "html",
            relativePath: "npm-deps-report.html"
          })
        })
      ])
    );
    expect(updatedSession.artifactIds).toContain(htmlArtifact.id);
  });

  it("executes provider-generated shell code when the user asks for a local file result", async () => {
    const app = createServerApp({
      dataDir: createTempDataDir(),
      env: {},
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: [
                    "我现在直接执行统计命令，你可以直接运行下方脚本得到最终结果：",
                    "",
                    "```bash",
                    "#!/bin/bash",
                    "text_count=$(find . -type f -name \"*.txt\" | wc -l | tr -d ' ')",
                    "echo \"TEXT_COUNT:${text_count}\"",
                    "```"
                  ].join("\n")
                }
              }
            ]
          }),
          { headers: { "content-type": "application/json" } }
        )
    });
    const currentSettings = await (await app.request("/api/settings")).json();
    await app.request("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        ...currentSettings,
        providerProfiles: [
          {
            id: "doubao",
            name: "Doubao",
            kind: "openai-compatible",
            baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
            apiKeyEnv: "direct-test-key-123456",
            model: "doubao-seed"
          }
        ],
        enabledToolIds: ["command.execute"]
      }),
      headers: { "content-type": "application/json" }
    });
    const workspacePath = createTempWorkspace();
    mkdirSync(join(workspacePath, "nested"), { recursive: true });
    writeFileSync(join(workspacePath, "a.txt"), "alpha");
    writeFileSync(join(workspacePath, "nested", "b.txt"), "beta");
    const project = await (
      await app.request("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Text Count Project", workspacePath }),
        headers: { "content-type": "application/json" }
      })
    ).json();
    const session = await (
      await app.request("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          title: "Count text files",
          providerProfileId: "doubao"
        }),
        headers: { "content-type": "application/json" }
      })
    ).json();

    const messageResponse = await app.request(`/api/sessions/${session.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "统计工作目录下有多少文本文件，给我结果" }),
      headers: { "content-type": "application/json" }
    });
    const updatedSession = await (await app.request(`/api/sessions/${session.id}`)).json();
    const events = await (await app.request(`/api/sessions/${session.id}/events.json`)).json();

    expect(messageResponse.status).toBe(200);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "tool.call",
          toolName: "command.execute",
          input: expect.objectContaining({
            command: expect.stringContaining("find . -type f -name")
          })
        }),
        expect.objectContaining({
          type: "tool.result",
          toolName: "command.execute",
          output: expect.objectContaining({
            exitCode: 0,
            stdout: expect.stringContaining("TEXT_COUNT:2")
          })
        })
      ])
    );
    expect(updatedSession.messages.at(-1).content).toContain("TEXT_COUNT:2");
    expect(updatedSession.messages.at(-1).content).not.toContain("#!/bin/bash");
  });

  it("uses provider-authored shell for repository counting instead of a hardcoded shortcut", async () => {
    const providerCalls: unknown[] = [];
    const app = createServerApp({
      dataDir: createTempDataDir(),
      env: {},
      fetchImpl: async (_input, init) => {
        providerCalls.push(init?.body);
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: [
                    "我会生成一个 workspace-bounded shell 统计命令。",
                    "",
                    "```bash",
                    "repo_count=$(find . -type d \\( -name .git -print -o -name node_modules -o -name .pnpm -o -name .harness-agent -o -name dist -o -name build \\) -prune | wc -l | tr -d '[:space:]')",
                    "echo \"REPO_COUNT:${repo_count}\"",
                    "```"
                  ].join("\n")
                }
              }
            ]
          }),
          { headers: { "content-type": "application/json" } }
        );
      }
    });
    const currentSettings = await (await app.request("/api/settings")).json();
    await app.request("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        ...currentSettings,
        providerProfiles: [
          {
            id: "doubao",
            name: "Doubao",
            kind: "openai-compatible",
            baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
            apiKeyEnv: "direct-test-key-123456",
            model: "doubao-seed"
          }
        ],
        enabledToolIds: ["command.execute"]
      }),
      headers: { "content-type": "application/json" }
    });
    const workspacePath = createTempWorkspace();
    mkdirSync(join(workspacePath, "repo-a", ".git"), { recursive: true });
    mkdirSync(join(workspacePath, "nested", "repo-b", ".git"), { recursive: true });
    const project = await (
      await app.request("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Stable Repo Count Project", workspacePath }),
        headers: { "content-type": "application/json" }
      })
    ).json();
    const session = await (
      await app.request("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          title: "Stable repo count",
          providerProfileId: "doubao"
        }),
        headers: { "content-type": "application/json" }
      })
    ).json();

    const messageResponse = await app.request(`/api/sessions/${session.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "统计工作目录下有多少代码库，给我结果" }),
      headers: { "content-type": "application/json" }
    });
    const updatedSession = await (await app.request(`/api/sessions/${session.id}`)).json();
    const events = await (await app.request(`/api/sessions/${session.id}/events.json`)).json();
    const commandCall = events.find(
      (event: { type: string; toolName?: string }) =>
        event.type === "tool.call" && event.toolName === "command.execute"
    );

    expect(messageResponse.status).toBe(200);
    expect(providerCalls).toHaveLength(1);
    expect(commandCall).toMatchObject({
      input: expect.objectContaining({
        command: expect.stringContaining("find .")
      })
    });
    expect(commandCall.input.command).not.toContain("xargs");
    expect(commandCall.input.command).not.toContain(workspacePath);
    expect(commandCall.input.command).toContain("node_modules");
    expect(commandCall.input.command).toContain("REPO_COUNT");
    expect(events).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "thinking",
          summary: expect.stringContaining("local repository count")
        })
      ])
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "tool.result",
          toolName: "command.execute",
          output: expect.objectContaining({
            exitCode: 0,
            stdout: expect.stringContaining("REPO_COUNT:2")
          })
        })
      ])
    );
    expect(updatedSession.messages.at(-1).content).toContain("REPO_COUNT:2");
    expect(updatedSession.messages.at(-1).content).not.toContain("工作目录下共统计到");
  });

  it("creates a session, runs a message through runtime, and replays SSE events", async () => {
    const app = createServerApp({
      dataDir: createTempDataDir(),
      runtime: {
        async *runTask({ sessionId }: { sessionId: string }): AsyncIterable<AgentEvent> {
          yield { type: "session.started", sessionId };
          yield { type: "message.delta", messageId: "message-1", text: "hello" };
          yield { type: "session.completed", sessionId };
        }
      }
    });
    const workspacePath = createTempWorkspace();
    const project = await (
      await app.request("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Local Project", workspacePath }),
        headers: { "content-type": "application/json" }
      })
    ).json();
    const session = await (
      await app.request("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ projectId: project.id, title: "Run task" }),
        headers: { "content-type": "application/json" }
      })
    ).json();

    const messageResponse = await app.request(`/api/sessions/${session.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "hello" }),
      headers: { "content-type": "application/json" }
    });
    expect(messageResponse.status).toBe(200);

    const events = await app.request(`/api/sessions/${session.id}/events`);
    const body = await events.text();

    expect(events.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain("session.started");
    expect(body).toContain("message.delta");
  });

  it("restores project sessions, messages, and events after the server app is recreated", async () => {
    const dataDir = createTempDataDir();
    const runtime = {
      async *runTask({ sessionId, messageId }: { sessionId: string; messageId: string }): AsyncIterable<AgentEvent> {
        yield { type: "session.started", sessionId };
        yield { type: "thinking", summary: "Checking persisted conversation flow." };
        yield { type: "message.delta", messageId, text: "persisted reply" };
        yield { type: "session.completed", sessionId };
      }
    };
    const firstApp = createServerApp({ dataDir, runtime });
    const workspacePath = createTempWorkspace();
    const project = await (
      await firstApp.request("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Persistent Project", workspacePath }),
        headers: { "content-type": "application/json" }
      })
    ).json();
    const session = await (
      await firstApp.request("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ projectId: project.id, title: "Persistent session" }),
        headers: { "content-type": "application/json" }
      })
    ).json();
    await firstApp.request(`/api/sessions/${session.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "hello persistence" }),
      headers: { "content-type": "application/json" }
    });

    const secondApp = createServerApp({ dataDir, runtime });
    const restoredSessions = await (
      await secondApp.request(`/api/sessions?projectId=${encodeURIComponent(project.id)}`)
    ).json();
    const restoredSession = await (
      await secondApp.request(`/api/sessions/${session.id}`)
    ).json();
    const restoredEvents = await (
      await secondApp.request(`/api/sessions/${session.id}/events.json`)
    ).json();

    expect(restoredSessions).toHaveLength(1);
    expect(restoredSession.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "user", content: "hello persistence" }),
        expect.objectContaining({ role: "assistant", content: "persisted reply" })
      ])
    );
    expect(restoredEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "thinking", summary: "Checking persisted conversation flow." })
      ])
    );
  });

  it("marks the session failed when the runtime throws", async () => {
    const app = createServerApp({
      dataDir: createTempDataDir(),
      runtime: {
        async *runTask({ sessionId }: { sessionId: string }): AsyncIterable<AgentEvent> {
          yield { type: "session.started", sessionId };
          throw new Error("runtime exploded");
        }
      }
    });
    const workspacePath = createTempWorkspace();
    const project = await (
      await app.request("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Local Project", workspacePath }),
        headers: { "content-type": "application/json" }
      })
    ).json();
    const session = await (
      await app.request("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ projectId: project.id, title: "Run task" }),
        headers: { "content-type": "application/json" }
      })
    ).json();

    const messageResponse = await app.request(`/api/sessions/${session.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "hello" }),
      headers: { "content-type": "application/json" }
    });
    const updatedSession = await (await app.request(`/api/sessions/${session.id}`)).json();
    const events = await (await app.request(`/api/sessions/${session.id}/events`)).text();

    expect(messageResponse.status).toBe(500);
    expect(updatedSession.status).toBe("failed");
    expect(updatedSession.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: "Task failed: runtime exploded"
        })
      ])
    );
    expect(events).toContain("\"type\":\"error\"");
  });
});
