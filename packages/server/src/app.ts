import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, extname, isAbsolute, join, normalize } from "node:path";

import {
  McpRegistry,
  SkillRegistry,
  ToolRegistry,
  buildAnthropicMessagesRequest,
  buildOpenAiCompatibleChatRequest,
  resolveProjectPath,
  type AgentEvent,
  type Artifact,
  type ArtifactKind,
  type ConversationMessage,
  type GlobalSettings,
  type Project,
  type ProviderMessage,
  type ProviderProfile
} from "@harness-agent/core";
import { createFixtureMcpAdapter } from "@harness-agent/mcp-fixtures";
import { registerBuiltInTools, writeArtifact } from "@harness-agent/tools";
import { Hono } from "hono";

import { createDefaultSettings } from "./config/default-settings";
import { SessionStore } from "./sessions/session-store";
import { JsonFileStore } from "./storage/json-store";
import { pickWorkspaceWithSystemDialog, type WorkspacePicker } from "./projects/workspace-picker";

export interface RuntimeTaskRequest {
  sessionId: string;
  messageId: string;
  project: Project;
  content: string;
  providerProfileId: string;
  messages: ConversationMessage[];
}

export interface RuntimeLike {
  runTask(request: RuntimeTaskRequest): AsyncIterable<AgentEvent>;
}

export interface CreateServerAppOptions {
  dataDir: string;
  runtime?: RuntimeLike;
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
  initialProjects?: Project[];
  initialArtifacts?: Artifact[];
  workspacePicker?: WorkspacePicker;
}

const artifactManifestPrefix = "HARNESS_ARTIFACT_JSON:";

function now(): string {
  return new Date().toISOString();
}

function createProject(input: { name: string; workspacePath: string }): Project {
  const timestamp = now();
  return {
    id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    workspacePath: input.workspacePath,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function sse(events: AgentEvent[]): Response {
  return new Response(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
    {
      headers: {
        "content-type": "text/event-stream"
      }
    }
  );
}

const providerSystemPrompt = [
  "You are Harness Agent, a local engineering assistant running in a browser/server prototype.",
  "Answer conversationally and directly.",
  "When local workspace observations are provided, treat them as authoritative and do not claim that you cannot access the user's files.",
  "When asked to generate artifacts or scripts, include fenced code blocks with accurate language labels so the harness can save and execute them.",
  `When an artifact depends on computed script output, make the script print one ${artifactManifestPrefix}<json> line. The JSON must be an object or array with artifact fields such as kind, title, content, or rows.`,
  "If a script writes artifact files directly, print the generated relative file path so the harness can register it for preview.",
  "All filesystem and command work is constrained to the selected project workspace."
].join(" ");

function looksLikeEnvVarName(value: string): boolean {
  return /^[A-Z_][A-Z0-9_]*$/.test(value);
}

function resolveProviderCredential(
  profile: ProviderProfile,
  env: Record<string, string | undefined>
): { value?: string; source: "env" | "direct" | "missing"; label?: string } {
  const configured = profile.apiKeyEnv.trim();
  if (!configured) {
    return { source: "missing" };
  }

  const envValue = env[configured];
  if (envValue) {
    return { value: envValue, source: "env", label: configured };
  }

  if (looksLikeEnvVarName(configured)) {
    return { source: "missing", label: configured };
  }

  return { value: configured, source: "direct" };
}

function appendEndpoint(baseUrl: string, endpoint: string): string {
  const trimmed = baseUrl.replace(/\/+$/g, "");
  return trimmed.endsWith(`/${endpoint}`) ? trimmed : `${trimmed}/${endpoint}`;
}

function providerMessagesFromConversation(
  messages: ConversationMessage[],
  fallbackContent: string
): ProviderMessage[] {
  const providerMessages = messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content
    }));

  return providerMessages.length > 0
    ? providerMessages
    : [{ role: "user", content: fallbackContent }];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function extractOpenAiCompatibleText(payload: unknown): string {
  const choices = asRecord(payload).choices;
  const firstChoice = Array.isArray(choices) ? asRecord(choices[0]) : {};
  const message = asRecord(firstChoice.message);
  const content = message.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        const record = asRecord(part);
        return typeof record.text === "string" ? record.text : "";
      })
      .join("");
  }

  return "";
}

function extractAnthropicText(payload: unknown): string {
  const content = asRecord(payload).content;
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      const record = asRecord(part);
      return typeof record.text === "string" ? record.text : "";
    })
    .join("");
}

async function readProviderJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Provider request failed with ${response.status}: ${text.slice(0, 500)}`);
  }

  return text ? JSON.parse(text) : {};
}

async function completeWithProvider(
  profile: ProviderProfile,
  apiKey: string,
  messages: ProviderMessage[],
  fetchImpl: typeof fetch,
  systemPrompt = providerSystemPrompt,
  maxTokens = 8192
): Promise<string> {
  if (profile.kind === "anthropic") {
    const response = await fetchImpl(appendEndpoint(profile.baseUrl, "messages"), {
      method: "POST",
      body: JSON.stringify(
        buildAnthropicMessagesRequest({
          model: profile.model,
          systemPrompt,
          messages,
          tools: [],
          maxTokens,
          temperature: 0.2
        })
      ),
      headers: {
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "x-api-key": apiKey
      }
    });
    const payload = await readProviderJson(response);
    const text = extractAnthropicText(payload).trim();
    if (!text) {
      throw new Error("Provider returned an empty assistant message.");
    }
    return text;
  }

  const response = await fetchImpl(appendEndpoint(profile.baseUrl, "chat/completions"), {
    method: "POST",
    body: JSON.stringify(
      buildOpenAiCompatibleChatRequest({
        model: profile.model,
        systemPrompt,
        messages,
        tools: [],
        maxTokens,
        temperature: 0.2
      })
    ),
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    }
  });
  const payload = await readProviderJson(response);
  const text = extractOpenAiCompatibleText(payload).trim();
  if (!text) {
    throw new Error("Provider returned an empty assistant message.");
  }
  return text;
}

function createBuiltInToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registerBuiltInTools(registry);
  return registry;
}

function shouldListWorkspace(content: string): boolean {
  return [
    /当前目录/,
    /目录.*(文件|有什么|有哪些)/,
    /有哪些文件/,
    /列出.*文件/,
    /桌面.*(文件|有什么|有哪些)/,
    /\bls\b/i,
    /\blist\b.*\b(files?|directory|folder)\b/i
  ].some((pattern) => pattern.test(content));
}

function formatObservationForProvider(toolName: string, input: unknown, output: unknown): string {
  return [
    `Local tool observation from ${toolName}:`,
    `Input: ${JSON.stringify(input)}`,
    `Output: ${JSON.stringify(output, null, 2)}`
  ].join("\n");
}

function formatObservationAnswer(output: unknown): string {
  const record = asRecord(output);
  const entries = Array.isArray(record.entries) ? record.entries.map(String) : [];
  const path = typeof record.path === "string" ? record.path : ".";
  if (entries.length === 0) {
    return `我已检查 workspace 中的 ${path}，当前没有看到可列出的文件。`;
  }
  return [`我已检查 workspace 中的 ${path}，看到这些条目：`, "", ...entries.map((entry) => `- ${entry}`)].join("\n");
}

type ArtifactWriteInput = Omit<Parameters<typeof writeArtifact>[0], "project">;

interface FencedCodeBlock {
  language: string;
  content: string;
  raw: string;
}

interface MaterializedArtifactBlock {
  input: ArtifactWriteInput;
  raw: string;
}

const artifactLanguageKinds: Record<string, ArtifactKind> = {
  csv: "csv",
  htm: "html",
  html: "html",
  json: "json",
  markdown: "markdown",
  md: "markdown",
  text: "text",
  txt: "text"
};
const artifactFileKinds: Record<string, ArtifactKind> = {
  csv: "csv",
  docx: "docx",
  htm: "html",
  html: "html",
  json: "json",
  markdown: "markdown",
  md: "markdown",
  pdf: "pdf",
  pptx: "pptx",
  text: "text",
  txt: "text",
  xlsx: "xlsx"
};
const artifactMimeTypes: Record<ArtifactKind, string> = {
  markdown: "text/markdown",
  html: "text/html",
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf",
  json: "application/json",
  text: "text/plain",
  image: "image/png"
};
const artifactKinds = new Set<ArtifactKind>([
  "markdown",
  "html",
  "csv",
  "xlsx",
  "docx",
  "pptx",
  "pdf",
  "json",
  "text",
  "image"
]);

function shouldMaterializeArtifacts(content: string): boolean {
  return /artifact|html|csv|json|markdown|\bmd\b|报告|报表|文档|文件|导出|生成/i.test(content);
}

function shouldRunNodeScript(content: string): boolean {
  return (
    /(?:node(?:\.js)?|nodejs|javascript|js|脚本)/i.test(content) &&
    (hasExecutionIntent(content) || wantsComputedLocalResult(content) || shouldMaterializeArtifacts(content))
  );
}

function hasExecutionIntent(content: string): boolean {
  return /执行|运行|跑一下|run|execute/i.test(content);
}

function shouldListFilesInScript(content: string): boolean {
  return /当前目录|目录|文件|files?|directory|folder|ls/i.test(content);
}

function extractFencedCodeBlocks(text: string): FencedCodeBlock[] {
  const blocks: FencedCodeBlock[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const opening = /```([a-zA-Z0-9_-]+)?[^\n]*\n/.exec(text.slice(cursor));
    if (!opening) {
      break;
    }
    const rawStart = cursor + opening.index;
    const contentStart = rawStart + opening[0].length;
    const closeStart = text.indexOf("```", contentStart);
    const rawEnd = closeStart === -1 ? text.length : closeStart + 3;
    const contentEnd = closeStart === -1 ? text.length : closeStart;

    blocks.push({
      language: (opening[1] ?? "").toLowerCase(),
      content: text.slice(contentStart, contentEnd).trim(),
      raw: text.slice(rawStart, rawEnd)
    });

    if (closeStart === -1) {
      break;
    }
    cursor = rawEnd;
  }

  return blocks;
}

function extractStandaloneHtml(text: string): string | undefined {
  const trimmed = text.trim();
  if (/^(?:<!doctype html|<html[\s>])/i.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}

function inferArtifactTitle(content: string, kind: ArtifactKind): string {
  if (kind === "html" && /报告|report/i.test(content)) {
    return "HTML Report";
  }
  if (kind === "csv") {
    return "CSV Data";
  }
  if (kind === "json") {
    return "JSON Data";
  }
  if (kind === "markdown") {
    return "Markdown Document";
  }
  return "Text Artifact";
}

function extractArtifactBlocks(
  sessionId: string,
  prompt: string,
  providerText: string
): MaterializedArtifactBlock[] {
  if (!shouldMaterializeArtifacts(prompt)) {
    return [];
  }

  const blocks: MaterializedArtifactBlock[] = [];
  for (const block of extractFencedCodeBlocks(providerText)) {
    const kind = artifactLanguageKinds[block.language];
    if (kind) {
      blocks.push({
        raw: block.raw,
        input: {
          sessionId,
          kind,
          title: inferArtifactTitle(prompt, kind),
          content: block.content
        }
      });
    }
  }

  if (blocks.length > 0) {
    return blocks;
  }

  const standaloneHtml = extractStandaloneHtml(providerText);
  return standaloneHtml
    ? [
        {
          raw: providerText,
          input: {
            sessionId,
            kind: "html",
            title: inferArtifactTitle(prompt, "html"),
            content: standaloneHtml
          }
        }
      ]
    : [];
}

function isArtifactKind(value: unknown): value is ArtifactKind {
  return typeof value === "string" && artifactKinds.has(value as ArtifactKind);
}

function artifactInputFromManifest(
  sessionId: string,
  value: unknown
): ArtifactWriteInput | undefined {
  const item = asRecord(value);
  if (!isArtifactKind(item.kind)) {
    return undefined;
  }
  const rows = Array.isArray(item.rows)
    ? item.rows.filter((row): row is Record<string, unknown> =>
        row !== null && typeof row === "object" && !Array.isArray(row)
      )
    : undefined;
  return {
    sessionId,
    kind: item.kind,
    title:
      typeof item.title === "string" && item.title.trim()
        ? item.title
        : inferArtifactTitle("", item.kind),
    content: typeof item.content === "string" ? item.content : undefined,
    rows
  };
}

function extractArtifactManifestInputs(
  sessionId: string,
  output: unknown
): ArtifactWriteInput[] {
  const result = asRecord(output);
  const stdout = typeof result.stdout === "string" ? result.stdout : "";
  const inputs: ArtifactWriteInput[] = [];

  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(artifactManifestPrefix)) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed.slice(artifactManifestPrefix.length));
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const input = artifactInputFromManifest(sessionId, item);
        if (input) {
          inputs.push(input);
        }
      }
    } catch {
      continue;
    }
  }

  return inputs;
}

function stripArtifactManifestLines(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(artifactManifestPrefix))
    .join("\n")
    .trim();
}

function artifactIdForExistingFile(sessionId: string, relativePath: string): string {
  const slug =
    relativePath
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 96) || "artifact";
  return `artifact-${sessionId}-existing-${slug}`;
}

function normalizeGeneratedArtifactPath(candidate: string): string | undefined {
  const withoutTrailingPunctuation = candidate
    .trim()
    .replace(/[),.;，。；）]+$/u, "");
  if (
    !withoutTrailingPunctuation ||
    isAbsolute(withoutTrailingPunctuation) ||
    /^[a-z][a-z0-9+.-]*:\/\//iu.test(withoutTrailingPunctuation)
  ) {
    return undefined;
  }

  const normalized = normalize(withoutTrailingPunctuation).replace(/^\.\//u, "");
  if (!normalized || normalized === "." || normalized.startsWith("..")) {
    return undefined;
  }
  return normalized;
}

function extractGeneratedArtifactPathCandidates(text: string): string[] {
  const extensionAlternation = Object.keys(artifactFileKinds).join("|");
  const pattern = new RegExp(
    String.raw`(?:^|[\s"'` + "`" + String.raw`(（:：])([^\s"'` + "`" + String.raw`<>]+?\.(${extensionAlternation}))(?:$|[\s"'` + "`" + String.raw`)）),.;，。；])`,
    "giu"
  );
  const candidates = new Set<string>();

  for (const match of text.matchAll(pattern)) {
    const candidate = match[1];
    const normalized = candidate ? normalizeGeneratedArtifactPath(candidate) : undefined;
    if (normalized) {
      candidates.add(normalized);
    }
  }

  return [...candidates];
}

function existingFileArtifact(
  project: Project,
  sessionId: string,
  relativePath: string
): Artifact | undefined {
  const extension = extname(relativePath).replace(/^\./u, "").toLowerCase();
  const kind = artifactFileKinds[extension];
  if (!kind) {
    return undefined;
  }

  try {
    const absolutePath = resolveProjectPath(project, relativePath);
    if (!existsSync(absolutePath)) {
      return undefined;
    }
    const stats = statSync(absolutePath);
    if (!stats.isFile()) {
      return undefined;
    }
    return {
      id: artifactIdForExistingFile(sessionId, relativePath),
      sessionId,
      projectId: project.id,
      kind,
      title: basename(relativePath),
      relativePath,
      mimeType: artifactMimeTypes[kind],
      sizeBytes: stats.size,
      createdAt: new Date().toISOString()
    };
  } catch {
    return undefined;
  }
}

function discoverGeneratedArtifactFiles(input: {
  project: Project;
  sessionId: string;
  texts: string[];
  existingRelativePaths: string[];
}): Artifact[] {
  const existing = new Set(input.existingRelativePaths);
  const artifacts: Artifact[] = [];
  const candidates = new Set(
    input.texts.flatMap((text) => extractGeneratedArtifactPathCandidates(text))
  );

  for (const relativePath of candidates) {
    if (existing.has(relativePath)) {
      continue;
    }
    const artifact = existingFileArtifact(input.project, input.sessionId, relativePath);
    if (artifact) {
      artifacts.push(artifact);
      existing.add(relativePath);
    }
  }

  return artifacts;
}

function extractNodeScript(providerText: string): { code: string; raw?: string } | undefined {
  const block = extractFencedCodeBlocks(providerText).find((item) =>
    ["js", "javascript", "node", "nodejs"].includes(item.language)
  );
  return block ? { code: block.content, raw: block.raw } : undefined;
}

function extractShellScript(providerText: string): { command: string; raw: string } | undefined {
  const block = extractFencedCodeBlocks(providerText).find((item) =>
    ["bash", "sh", "shell", "zsh"].includes(item.language)
  );
  return block ? { command: block.content, raw: block.raw } : undefined;
}

function cleanupInlineCommand(command: string): string {
  return command
    .trim()
    .replace(/[，。；;、]+$/u, "")
    .trim();
}

function extractShellCommand(content: string): string | undefined {
  if (!hasExecutionIntent(content)) {
    return undefined;
  }

  const shellBlock = extractFencedCodeBlocks(content).find((block) =>
    ["bash", "sh", "shell", "zsh"].includes(block.language)
  );
  if (shellBlock?.content) {
    return shellBlock.content;
  }

  const inlineCommand = /(?:执行|运行|run|execute)[^`]*`([^`]+)`/iu.exec(content)?.[1];
  if (inlineCommand) {
    return cleanupInlineCommand(inlineCommand);
  }

  const labeledCommand =
    /(?:执行|运行|run|execute)\s*(?:shell\s*)?(?:命令|指令|command)?\s*[:：]\s*([^\n]+)/iu.exec(content)?.[1] ??
    /(?:shell|终端|terminal)\s*(?:命令|指令|command)?\s*[:：]\s*([^\n]+)/iu.exec(content)?.[1];
  return labeledCommand ? cleanupInlineCommand(labeledCommand) : undefined;
}

function wantsComputedLocalResult(content: string): boolean {
  return (
    /(统计|多少|数量|结果|计算|查找|列出|检查|分析|count|how many|result)/iu.test(content) &&
    /(工作目录|workspace|目录|文件|代码库|仓库|repo|repository|project)/iu.test(content)
  );
}

function buildLocalNodeScript(content: string): string {
  if (shouldListFilesInScript(content)) {
    return [
      'const { readdirSync } = require("node:fs");',
      "",
      "const entries = readdirSync(process.cwd()).sort();",
      "console.log(entries.join(\"\\n\"));"
    ].join("\n");
  }

  return [
    "const message = \"Harness Agent Node.js script executed.\";",
    "console.log(message);"
  ].join("\n");
}

function stripHandledBlocks(text: string, rawBlocks: string[]): string {
  return rawBlocks.reduce((current, raw) => current.replace(raw, ""), text).trim();
}

function formatArtifactSummary(artifacts: Artifact[]): string {
  if (artifacts.length === 0) {
    return "";
  }

  return artifacts
    .map((artifact) => `已生成 ${artifact.kind.toUpperCase()} artifact：${artifact.title}，可在 Artifacts 中预览。`)
    .join("\n");
}

function formatCommandExecutionSummary(scriptPath: string, output: unknown): string {
  const result = asRecord(output);
  const stdout =
    typeof result.stdout === "string" ? stripArtifactManifestLines(result.stdout) : "";
  const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
  const exitCode = result.exitCode ?? "unknown";
  const signal = typeof result.signal === "string" ? result.signal : undefined;
  const exitLabel = signal && exitCode === "unknown" ? `signal ${signal}` : exitCode;
  return [
    `已在 workspace 内写入并执行 Node.js 脚本：\`${scriptPath}\`。`,
    "",
    `退出码：${exitLabel}`,
    "",
    "stdout:",
    "```text",
    stdout || "(empty)",
    "```",
    stderr ? ["", "stderr:", "```text", stderr, "```"].join("\n") : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function commandInputForSettings(command: string, settings: GlobalSettings, cwd = ".") {
  return {
    command,
    cwd,
    timeoutMs: settings.commandPolicy.timeoutMs,
    maxOutputBytes: settings.commandPolicy.maxOutputBytes
  };
}

function formatShellCommandExecutionSummary(command: string, output: unknown): string {
  const result = asRecord(output);
  const stdout = typeof result.stdout === "string" ? result.stdout.trim() : "";
  const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
  const exitCode = result.exitCode ?? "unknown";
  const signal = typeof result.signal === "string" ? result.signal : undefined;
  const exitLabel = signal && exitCode === "unknown" ? `signal ${signal}` : exitCode;
  const commandTitle = command.includes("\n")
    ? "已在 workspace 内执行 shell 脚本。"
    : `已在 workspace 内执行 shell 命令：\`${command}\`。`;
  return [
    commandTitle,
    "",
    `退出码：${exitLabel}`,
    "",
    "stdout:",
    "```text",
    stdout || "(empty)",
    "```",
    stderr ? ["", "stderr:", "```text", stderr, "```"].join("\n") : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function loadMatchingEnabledSkills(settings: GlobalSettings, content: string) {
  const enabledSkillPaths = settings.skillPaths.filter((skillPath) =>
    settings.enabledSkillPaths.includes(skillPath)
  );
  if (enabledSkillPaths.length === 0) {
    return [];
  }

  return SkillRegistry.load(enabledSkillPaths).match(content);
}

async function* runLocalArtifactDemo(
  request: RuntimeTaskRequest,
  reason: string
): AsyncIterable<AgentEvent> {
  if (reason) {
    yield {
      type: "message.delta",
      messageId: request.messageId,
      text: `${reason} `
    };
  }
  yield {
    type: "message.delta",
    messageId: request.messageId,
    text: "Running a local harness task inside the selected project. "
  };

  const commonContent = [
    `Prompt: ${request.content}`,
    "",
    "This local runtime demonstrates workspace-bounded artifact generation without requiring an API key."
  ].join("\n");
  const artifactInputs: Omit<Parameters<typeof writeArtifact>[0], "project">[] = [
    {
      sessionId: request.sessionId,
      kind: "markdown",
      title: "Local Task Summary",
      content: commonContent
    },
    {
      sessionId: request.sessionId,
      kind: "html",
      title: "Local Task Preview",
      content: `<h1>Local Task Preview</h1><p>${request.content}</p>`
    },
    {
      sessionId: request.sessionId,
      kind: "csv",
      title: "Local Task Data",
      rows: [
        { metric: "provider", value: request.providerProfileId },
        { metric: "workspace", value: request.project.workspacePath },
        { metric: "prompt", value: request.content }
      ]
    },
    {
      sessionId: request.sessionId,
      kind: "xlsx",
      title: "Local Task Workbook",
      rows: [
        { step: "plan", status: "done" },
        { step: "artifact generation", status: "done" },
        { step: "preview wiring", status: "done" }
      ]
    },
    {
      sessionId: request.sessionId,
      kind: "docx",
      title: "Local Task Document",
      content: commonContent
    },
    {
      sessionId: request.sessionId,
      kind: "pptx",
      title: "Local Task Deck",
      content: commonContent
    },
    {
      sessionId: request.sessionId,
      kind: "pdf",
      title: "Local Task Brief",
      content: commonContent
    }
  ];

  for (const artifactInput of artifactInputs) {
    const callId = `artifact-${artifactInput.kind}`;
    yield {
      type: "tool.call",
      callId,
      toolName: "artifact.write",
      input: artifactInput
    };
    const artifact = await writeArtifact({
      ...artifactInput,
      project: request.project
    });
    yield {
      type: "tool.result",
      callId,
      toolName: "artifact.write",
      output: artifact
    };
    yield { type: "artifact.created", artifact };
  }

  yield {
    type: "message.delta",
    messageId: request.messageId,
    text: "Generated local artifacts: markdown, html, csv, xlsx, docx, pptx, and pdf."
  };
  yield { type: "message.completed", messageId: request.messageId };
  yield { type: "session.completed", sessionId: request.sessionId };
}

function createDefaultRuntime(options: {
  getSettings: () => GlobalSettings;
  fetchImpl: typeof fetch;
  env: Record<string, string | undefined>;
}): RuntimeLike {
  return {
    async *runTask(request: RuntimeTaskRequest): AsyncIterable<AgentEvent> {
      yield { type: "session.started", sessionId: request.sessionId };
      yield { type: "thinking", summary: "Understanding the request and checking enabled capabilities." };
      const settings = options.getSettings();
      const profile = settings.providerProfiles.find((item) => item.id === request.providerProfileId);
      const credential = profile
        ? resolveProviderCredential(profile, options.env)
        : { source: "missing" as const };
      const providerMessages = providerMessagesFromConversation(request.messages, request.content);
      const supplementalMessages: ProviderMessage[] = [];
      const toolRegistry = createBuiltInToolRegistry();
      const enabledTools = new Set(settings.enabledToolIds);

      for (const skill of loadMatchingEnabledSkills(settings, request.content)) {
        yield {
          type: "skill.match",
          skillName: skill.name,
          path: skill.path,
          reason: "Prompt matched an enabled skill."
        };
        supplementalMessages.push({
          role: "system",
          content: [
            `Enabled skill matched: ${skill.name}`,
            `Description: ${skill.description}`,
            `Instructions:\n${skill.instructions}`
          ].join("\n")
        });
      }

      const shellCommand = extractShellCommand(request.content);
      if (shellCommand && enabledTools.has("command.execute")) {
        yield { type: "thinking", summary: "The request asks to execute a shell command, so I will run it inside the selected workspace." };
        const commandInput = commandInputForSettings(shellCommand, settings);
        const commandCallId = `command-execute-${Date.now()}`;
        yield {
          type: "tool.call",
          callId: commandCallId,
          toolName: "command.execute",
          input: commandInput
        };
        const commandOutput = await toolRegistry.call("command.execute", {
          project: request.project,
          input: commandInput
        });
        yield {
          type: "tool.result",
          callId: commandCallId,
          toolName: "command.execute",
          output: commandOutput
        };
        yield {
          type: "message.delta",
          messageId: request.messageId,
          text: formatShellCommandExecutionSummary(shellCommand, commandOutput)
        };
        yield { type: "message.completed", messageId: request.messageId };
        yield { type: "session.completed", sessionId: request.sessionId };
        return;
      }

      if (
        !credential.value &&
        shouldRunNodeScript(request.content) &&
        enabledTools.has("filesystem.write") &&
        enabledTools.has("command.execute")
      ) {
        yield { type: "thinking", summary: "The request asks for a Node.js script, so I will write it inside the workspace." };
        const scriptPath = `.harness-agent/scripts/${request.sessionId}/script.js`;
        const scriptContent = buildLocalNodeScript(request.content);
        const writeInput = { path: scriptPath, content: scriptContent };
        const writeCallId = `filesystem-write-${Date.now()}`;
        yield {
          type: "tool.call",
          callId: writeCallId,
          toolName: "filesystem.write",
          input: writeInput
        };
        const writeOutput = await toolRegistry.call("filesystem.write", {
          project: request.project,
          input: writeInput
        });
        yield {
          type: "tool.result",
          callId: writeCallId,
          toolName: "filesystem.write",
          output: writeOutput
        };

        yield { type: "thinking", summary: "The script has been written; now I will execute it with Node.js in the project workspace." };
        const commandInput = commandInputForSettings(`node ${scriptPath}`, settings);
        const commandCallId = `command-execute-${Date.now()}`;
        yield {
          type: "tool.call",
          callId: commandCallId,
          toolName: "command.execute",
          input: commandInput
        };
        const commandOutput = await toolRegistry.call("command.execute", {
          project: request.project,
          input: commandInput
        });
        yield {
          type: "tool.result",
          callId: commandCallId,
          toolName: "command.execute",
          output: commandOutput
        };
        yield {
          type: "message.delta",
          messageId: request.messageId,
          text: formatCommandExecutionSummary(scriptPath, commandOutput)
        };
        yield { type: "message.completed", messageId: request.messageId };
        yield { type: "session.completed", sessionId: request.sessionId };
        return;
      }

      if (shouldListWorkspace(request.content) && enabledTools.has("filesystem.list")) {
        yield { type: "thinking", summary: "The request needs local workspace context, so I will inspect the project directory." };
        const callId = `filesystem-list-${Date.now()}`;
        const input = { path: "." };
        yield {
          type: "tool.call",
          callId,
          toolName: "filesystem.list",
          input
        };
        const output = await toolRegistry.call("filesystem.list", {
          project: request.project,
          input
        });
        yield {
          type: "tool.result",
          callId,
          toolName: "filesystem.list",
          output
        };
        supplementalMessages.push({
          role: "system",
          content: formatObservationForProvider("filesystem.list", input, output)
        });

        if (!credential.value) {
          yield {
            type: "message.delta",
            messageId: request.messageId,
            text: formatObservationAnswer(output)
          };
          yield { type: "message.completed", messageId: request.messageId };
          yield { type: "session.completed", sessionId: request.sessionId };
          return;
        }
      }

      if (profile && credential.value) {
        yield { type: "thinking", summary: "Preparing the final answer with tool observations and conversation context." };
        const text = await completeWithProvider(
          profile,
          credential.value,
          [...supplementalMessages, ...providerMessages],
          options.fetchImpl,
          [
            providerSystemPrompt,
            `Selected project workspace: ${request.project.workspacePath}`,
            supplementalMessages.length > 0
              ? "Use the following system observations and skill instructions before answering."
              : ""
          ]
            .filter(Boolean)
            .join("\n")
        );
        const rawBlocksToStrip: string[] = [];
        const createdArtifacts: Artifact[] = [];

        if (enabledTools.has("artifact.write")) {
          const artifactBlocks = extractArtifactBlocks(request.sessionId, request.content, text);
          if (artifactBlocks.length > 0) {
            yield { type: "thinking", summary: "The provider returned artifact content, so I will save it as previewable project files." };
          }
          for (const artifactBlock of artifactBlocks) {
            const callId = `artifact-write-${Date.now()}-${artifactBlock.input.kind}`;
            yield {
              type: "tool.call",
              callId,
              toolName: "artifact.write",
              input: artifactBlock.input
            };
            const artifact = (await toolRegistry.call("artifact.write", {
              project: request.project,
              input: artifactBlock.input
            })) as Artifact;
            yield {
              type: "tool.result",
              callId,
              toolName: "artifact.write",
              output: artifact
            };
            yield { type: "artifact.created", artifact };
            createdArtifacts.push(artifact);
            rawBlocksToStrip.push(artifactBlock.raw);
          }
        }

        let executionSummary = "";
        if (
          shouldRunNodeScript(request.content) &&
          enabledTools.has("filesystem.write") &&
          enabledTools.has("command.execute")
        ) {
          const script = extractNodeScript(text);
          const scriptPath = `.harness-agent/scripts/${request.sessionId}/script.js`;
          const scriptContent = script?.code ?? buildLocalNodeScript(request.content);
          if (script?.raw) {
            rawBlocksToStrip.push(script.raw);
          }
          yield { type: "thinking", summary: "The request asks to execute a Node.js script, so I will write the script into the workspace." };
          const writeInput = { path: scriptPath, content: scriptContent };
          const writeCallId = `filesystem-write-${Date.now()}`;
          yield {
            type: "tool.call",
            callId: writeCallId,
            toolName: "filesystem.write",
            input: writeInput
          };
          const writeOutput = await toolRegistry.call("filesystem.write", {
            project: request.project,
            input: writeInput
          });
          yield {
            type: "tool.result",
            callId: writeCallId,
            toolName: "filesystem.write",
            output: writeOutput
          };

          yield { type: "thinking", summary: "The script has been written; now I will execute it with Node.js in the project workspace." };
          const commandInput = commandInputForSettings(`node ${scriptPath}`, settings);
          const commandCallId = `command-execute-${Date.now()}`;
          yield {
            type: "tool.call",
            callId: commandCallId,
            toolName: "command.execute",
            input: commandInput
          };
          const commandOutput = await toolRegistry.call("command.execute", {
            project: request.project,
            input: commandInput
          });
          yield {
            type: "tool.result",
            callId: commandCallId,
            toolName: "command.execute",
            output: commandOutput
          };
          const generatedArtifactInputs = extractArtifactManifestInputs(
            request.sessionId,
            commandOutput
          );
          if (generatedArtifactInputs.length > 0 && enabledTools.has("artifact.write")) {
            yield { type: "thinking", summary: "The executed script returned artifact manifests, so I will save them as previewable project files." };
            for (const artifactInput of generatedArtifactInputs) {
              const callId = `artifact-write-${Date.now()}-${artifactInput.kind}`;
              yield {
                type: "tool.call",
                callId,
                toolName: "artifact.write",
                input: artifactInput
              };
              const artifact = (await toolRegistry.call("artifact.write", {
                project: request.project,
                input: artifactInput
              })) as Artifact;
              yield {
                type: "tool.result",
                callId,
                toolName: "artifact.write",
                output: artifact
              };
              yield { type: "artifact.created", artifact };
              createdArtifacts.push(artifact);
            }
          }
          const commandOutputRecord = asRecord(commandOutput);
          const commandStdout =
            typeof commandOutputRecord.stdout === "string" ? commandOutputRecord.stdout : "";
          const generatedFileArtifacts = enabledTools.has("artifact.write")
            ? discoverGeneratedArtifactFiles({
                project: request.project,
                sessionId: request.sessionId,
                texts: [scriptContent, commandStdout],
                existingRelativePaths: createdArtifacts.map((artifact) => artifact.relativePath)
              })
            : [];
          if (generatedFileArtifacts.length > 0) {
            yield { type: "thinking", summary: "The executed script generated artifact files, so I will register them for preview." };
            for (const artifact of generatedFileArtifacts) {
              yield { type: "artifact.created", artifact };
              createdArtifacts.push(artifact);
            }
          }
          executionSummary = formatCommandExecutionSummary(scriptPath, commandOutput);
        }

        let generatedShellExecutionSummary = "";
        if (!executionSummary && wantsComputedLocalResult(request.content) && enabledTools.has("command.execute")) {
          const shellScript = extractShellScript(text);
          if (shellScript) {
            rawBlocksToStrip.push(shellScript.raw);
            yield { type: "thinking", summary: "The provider returned a shell script for a requested local result, so I will execute it inside the workspace." };
            const commandInput = commandInputForSettings(shellScript.command, settings);
            const commandCallId = `command-execute-${Date.now()}`;
            yield {
              type: "tool.call",
              callId: commandCallId,
              toolName: "command.execute",
              input: commandInput
            };
            const commandOutput = await toolRegistry.call("command.execute", {
              project: request.project,
              input: commandInput
            });
            yield {
              type: "tool.result",
              callId: commandCallId,
              toolName: "command.execute",
              output: commandOutput
            };
            generatedShellExecutionSummary = formatShellCommandExecutionSummary(shellScript.command, commandOutput);
          }
        }

        const baseText = generatedShellExecutionSummary ? "" : stripHandledBlocks(text, rawBlocksToStrip);
        const finalText = [
          baseText,
          formatArtifactSummary(createdArtifacts),
          executionSummary,
          generatedShellExecutionSummary
        ]
          .filter(Boolean)
          .join("\n\n");
        yield {
          type: "message.delta",
          messageId: request.messageId,
          text: finalText || text
        };
        yield { type: "message.completed", messageId: request.messageId };
        yield { type: "session.completed", sessionId: request.sessionId };
        return;
      }

      const fallbackReason = profile
        ? `Provider ${profile.name} has no configured API key.`
        : `Provider ${request.providerProfileId} was not found.`;
      yield* runLocalArtifactDemo(request, fallbackReason);
    }
  };
}

function previewArtifact(artifact: Artifact, content: string): Record<string, unknown> {
  if (artifact.kind === "json") {
    return { kind: artifact.kind, json: JSON.parse(content) };
  }

  if (artifact.kind === "csv") {
    return { kind: artifact.kind, content, rows: parseCsvRows(content) };
  }

  if (
    artifact.kind === "markdown" ||
    artifact.kind === "html" ||
    artifact.kind === "text"
  ) {
    return { kind: artifact.kind, content };
  }

  return {
    kind: artifact.kind,
    title: artifact.title,
    mimeType: artifact.mimeType,
    sizeBytes: artifact.sizeBytes
  };
}

function parseCsvRows(content: string): Record<string, string>[] {
  const [headerLine, ...lines] = content.trim().split(/\r?\n/);
  if (!headerLine) {
    return [];
  }
  const headers = headerLine.split(",");

  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function isTextArtifact(kind: Artifact["kind"]): boolean {
  return kind === "markdown" || kind === "html" || kind === "csv" || kind === "json" || kind === "text";
}

function upsertArtifact(artifacts: Artifact[], artifact: Artifact): Artifact[] {
  return [...artifacts.filter((item) => item.id !== artifact.id), artifact];
}

function listBuiltInTools(settings: GlobalSettings): Record<string, unknown>[] {
  const registry = new ToolRegistry();
  registerBuiltInTools(registry);
  const enabled = new Set(settings.enabledToolIds);

  return registry.list().map((tool) => ({
    ...tool,
    enabled: enabled.has(tool.id)
  }));
}

function testProvider(
  profile: ProviderProfile,
  env: Record<string, string | undefined>
): Record<string, unknown> {
  const credential = resolveProviderCredential(profile, env);
  const apiKeyConfigured = Boolean(credential.value);
  const openAiCompatible = profile.kind === "openai" || profile.kind === "openai-compatible";
  const validProtocol = openAiCompatible || profile.kind === "anthropic";
  const validUrl = profile.baseUrl.startsWith("http://") || profile.baseUrl.startsWith("https://");

  return {
    ok: validProtocol && validUrl,
    profileId: profile.id,
    kind: profile.kind,
    model: profile.model,
    baseUrl: profile.baseUrl,
    apiKeyEnv: credential.source === "direct" ? undefined : credential.label,
    apiKeyConfigured,
    apiKeySource: credential.source,
    message: apiKeyConfigured
      ? `Provider shape is valid and API key is configured via ${credential.source}.`
      : `Provider shape is valid. Set ${credential.label ?? "an API key"} before making live LLM calls.`
  };
}

function loadSkills(settings: GlobalSettings): Record<string, unknown> {
  const enabled = new Set(settings.enabledSkillPaths);
  const loaded = [];
  const errors = [];

  for (const skillPath of settings.skillPaths) {
    try {
      const skill = SkillRegistry.load([skillPath]).list()[0];
      if (skill) {
        loaded.push({
          ...skill,
          enabled: enabled.has(skillPath)
        });
      }
    } catch (error) {
      errors.push({
        path: skillPath,
        message: (error as Error).message
      });
    }
  }

  return { skills: loaded, errors };
}

export function createServerApp(options: CreateServerAppOptions): Hono {
  const app = new Hono();
  const projectsStore = new JsonFileStore<Project[]>(
    join(options.dataDir, "projects.json"),
    options.initialProjects ?? []
  );
  const settingsStore = new JsonFileStore<GlobalSettings>(
    join(options.dataDir, "settings.json"),
    createDefaultSettings()
  );
  const artifactStore = new JsonFileStore<Artifact[]>(
    join(options.dataDir, "artifacts.json"),
    options.initialArtifacts ?? []
  );
  const sessions = new SessionStore([], join(options.dataDir, "conversations.sqlite"));
  const runtime =
    options.runtime ??
    createDefaultRuntime({
      getSettings: () => settingsStore.get(),
      fetchImpl: options.fetchImpl ?? fetch,
      env: options.env ?? process.env
    });
  const workspacePicker = options.workspacePicker ?? pickWorkspaceWithSystemDialog;

  app.get("/api/health", (context) => context.json({ ok: true }));

  app.get("/api/projects", (context) => context.json(projectsStore.get()));
  app.post("/api/workspaces/pick", async (context) => {
    try {
      const workspacePath = await workspacePicker();
      return context.json({ workspacePath });
    } catch (error) {
      return context.json({ error: (error as Error).message }, 500);
    }
  });
  app.post("/api/projects", async (context) => {
    const body = (await context.req.json()) as { name: string; workspacePath: string };
    const project = createProject(body);
    projectsStore.set([...projectsStore.get(), project]);
    return context.json(project);
  });
  app.patch("/api/projects/:projectId", async (context) => {
    const projectId = context.req.param("projectId");
    const body = (await context.req.json()) as Partial<Project>;
    const projects = projectsStore.get();
    const project = projects.find((item) => item.id === projectId);
    if (!project) {
      return context.json({ error: "Project not found" }, 404);
    }
    const updated = { ...project, ...body, id: project.id, updatedAt: now() };
    projectsStore.set(projects.map((item) => (item.id === projectId ? updated : item)));
    return context.json(updated);
  });
  app.delete("/api/projects/:projectId", (context) => {
    const projectId = context.req.param("projectId");
    projectsStore.set(projectsStore.get().filter((project) => project.id !== projectId));
    sessions.deleteProject(projectId);
    artifactStore.set(artifactStore.get().filter((artifact) => artifact.projectId !== projectId));
    return context.body(null, 204);
  });

  app.get("/api/settings", (context) => context.json(settingsStore.get()));
  app.put("/api/settings", async (context) => {
    const body = (await context.req.json()) as GlobalSettings;
    settingsStore.set(body);
    return context.json(body);
  });
  app.get("/api/tools", (context) => context.json(listBuiltInTools(settingsStore.get())));
  app.get("/api/skills", (context) => context.json(loadSkills(settingsStore.get())));
  app.get("/api/mcp/tools", async (context) => {
    const settings = settingsStore.get();
    const enabled = new Set(settings.enabledMcpServerIds);
    const registry = new McpRegistry(
      createFixtureMcpAdapter(),
      settings.mcpServers.filter((server) => enabled.has(server.id))
    );

    return context.json(await registry.listTools());
  });
  app.post("/api/providers/test", async (context) => {
    const body = (await context.req.json().catch(() => ({}))) as { profile?: ProviderProfile };
    const profile = body.profile ?? settingsStore.get().providerProfiles[0];
    if (!profile) {
      return context.json({ ok: false, message: "No provider profile configured." }, 400);
    }

    return context.json(testProvider(profile, options.env ?? process.env));
  });
  app.post("/api/mcp/test", async (context) => {
    const body = (await context.req.json().catch(() => ({}))) as { serverId?: string };
    const settings = settingsStore.get();
    const server = settings.mcpServers.find((item) => item.id === body.serverId) ?? settings.mcpServers[0];
    if (!server) {
      return context.json({ ok: false, message: "No MCP server configured." }, 400);
    }
    const tools = await createFixtureMcpAdapter().listTools(server);

    return context.json({
      ok: true,
      serverId: server.id,
      toolCount: tools.length,
      tools
    });
  });

  app.get("/api/artifacts", (context) => {
    const projectId = context.req.query("projectId");
    const sessionId = context.req.query("sessionId");
    return context.json(
      artifactStore
        .get()
        .filter((artifact) => !projectId || artifact.projectId === projectId)
        .filter((artifact) => !sessionId || artifact.sessionId === sessionId)
    );
  });

  app.get("/api/sessions", (context) => {
    const projectId = context.req.query("projectId");
    return context.json(sessions.list(projectId));
  });
  app.post("/api/sessions", async (context) => {
    const body = (await context.req.json()) as {
      projectId: string;
      title: string;
      providerProfileId?: string;
    };
    const settings = settingsStore.get();
    const providerProfileId = body.providerProfileId ?? settings.providerProfiles[0]?.id ?? "local";
    return context.json(
      sessions.create({
        projectId: body.projectId,
        title: body.title,
        providerProfileId
      })
    );
  });
  app.get("/api/sessions/:sessionId", (context) => {
    const session = sessions.get(context.req.param("sessionId"));
    return session ? context.json(session) : context.json({ error: "Session not found" }, 404);
  });
  app.post("/api/sessions/:sessionId/messages", async (context) => {
    const sessionId = context.req.param("sessionId");
    const session = sessions.get(sessionId);
    if (!session) {
      return context.json({ error: "Session not found" }, 404);
    }
    const project = projectsStore.get().find((item) => item.id === session.projectId);
    if (!project) {
      return context.json({ error: "Project not found" }, 404);
    }
    const body = (await context.req.json()) as { content: string };
    const messageId = `message-${Date.now()}`;
    sessions.appendMessage(sessionId, {
      id: messageId,
      role: "user",
      content: body.content,
      createdAt: now()
    });
    sessions.update(sessionId, { status: "running" });

    try {
      let assistantContent = "";
      for await (const event of runtime.runTask({
        sessionId,
        messageId,
        project,
        content: body.content,
        providerProfileId: session.providerProfileId,
        messages: sessions.get(sessionId)?.messages ?? []
      })) {
        sessions.appendEvent(sessionId, event);
        if (event.type === "message.delta") {
          assistantContent += event.text;
        }
        if (event.type === "artifact.created") {
          artifactStore.set(upsertArtifact(artifactStore.get(), event.artifact));
          const latestSession = sessions.get(sessionId);
          sessions.update(sessionId, {
            artifactIds: [...new Set([...(latestSession?.artifactIds ?? []), event.artifact.id])]
          });
        }
      }
      if (assistantContent) {
        sessions.appendMessage(sessionId, {
          id: `${messageId}-assistant`,
          role: "assistant",
          content: assistantContent,
          createdAt: now()
        });
      }
      sessions.update(sessionId, { status: "completed" });
      return context.json({ ok: true, events: sessions.events(sessionId).length });
    } catch (error) {
      const message = (error as Error).message;
      sessions.appendEvent(sessionId, { type: "error", message, recoverable: false });
      sessions.appendMessage(sessionId, {
        id: `${messageId}-error`,
        role: "assistant",
        content: `Task failed: ${message}`,
        createdAt: now()
      });
      sessions.update(sessionId, { status: "failed" });
      return context.json({ error: message }, 500);
    }
  });
  app.post("/api/sessions/:sessionId/cancel", (context) => {
    const sessionId = context.req.param("sessionId");
    sessions.update(sessionId, { status: "cancelled" });
    return context.json({ ok: true });
  });
  app.get("/api/sessions/:sessionId/events", (context) =>
    sse(sessions.events(context.req.param("sessionId")))
  );
  app.get("/api/sessions/:sessionId/events.json", (context) =>
    context.json(sessions.events(context.req.param("sessionId")))
  );

  app.get("/api/artifacts/:artifactId", (context) => {
    const artifact = artifactStore.get().find((item) => item.id === context.req.param("artifactId"));
    if (!artifact) {
      return context.json({ error: "Artifact not found" }, 404);
    }
    const project = projectsStore.get().find((item) => item.id === artifact.projectId);
    if (!project) {
      return context.json({ error: "Project not found" }, 404);
    }

    try {
      const path = resolveProjectPath(project, artifact.relativePath);
      if (!existsSync(path)) {
        return context.json({ error: "Artifact file not found" }, 404);
      }
      const headers = {
        "content-type": artifact.mimeType,
        "content-length": String(statSync(path).size)
      };
      if (isTextArtifact(artifact.kind)) {
        return context.text(readFileSync(path, "utf8"), 200, headers);
      }

      return new Response(readFileSync(path), {
        status: 200,
        headers
      });
    } catch (error) {
      return context.json({ error: (error as Error).message }, 400);
    }
  });
  app.get("/api/artifacts/:artifactId/preview", (context) => {
    const artifact = artifactStore.get().find((item) => item.id === context.req.param("artifactId"));
    if (!artifact) {
      return context.json({ error: "Artifact not found" }, 404);
    }
    const project = projectsStore.get().find((item) => item.id === artifact.projectId);
    if (!project) {
      return context.json({ error: "Project not found" }, 404);
    }

    try {
      const path = resolveProjectPath(project, artifact.relativePath);
      if (!existsSync(path)) {
        return context.json({ error: "Artifact file not found" }, 404);
      }
      const content = isTextArtifact(artifact.kind) ? readFileSync(path, "utf8") : "";
      return context.json(previewArtifact(artifact, content));
    } catch (error) {
      return context.json({ error: (error as Error).message }, 400);
    }
  });

  return app;
}
