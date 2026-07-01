import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  GlobalSettingsDto,
  McpServerDto,
  McpTestResultDto,
  ProviderKindDto,
  ProviderProfileDto,
  ProviderTestResultDto,
  SkillLoadResultDto,
  ToolDefinitionDto
} from "@/lib/api-client";

const emptyProvider: ProviderProfileDto = {
  id: "",
  name: "",
  kind: "openai-compatible",
  baseUrl: "",
  apiKeyEnv: "",
  model: ""
};

interface McpServerForm {
  id: string;
  name: string;
  transport: "stdio" | "http";
  command: string;
  url: string;
}

const emptyMcpServer: McpServerForm = {
  id: "",
  name: "",
  transport: "stdio",
  command: "",
  url: ""
};

function toggleValue(values: string[], value: string, enabled: boolean): string[] {
  if (enabled) {
    return [...new Set([...values, value])];
  }

  return values.filter((item) => item !== value);
}

function looksLikeEnvVarName(value: string): boolean {
  return /^[A-Z_][A-Z0-9_]*$/.test(value);
}

function describeProviderCredential(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "No API key configured";
  }
  return looksLikeEnvVarName(trimmed) ? trimmed : "Direct API key configured";
}

function mcpFormToServer(form: McpServerForm): McpServerDto {
  if (form.transport === "http") {
    return {
      id: form.id,
      name: form.name,
      transport: "http",
      url: form.url
    };
  }

  return {
    id: form.id,
    name: form.name,
    transport: "stdio",
    command: form.command,
    args: []
  };
}

export interface SettingsPageProps {
  settings?: GlobalSettingsDto;
  tools?: ToolDefinitionDto[];
  mcpTools?: ToolDefinitionDto[];
  skills?: SkillLoadResultDto;
  providerTest?: ProviderTestResultDto;
  mcpTest?: McpTestResultDto;
  onSaveSettings?: (settings: GlobalSettingsDto) => void | Promise<void>;
  onTestProvider?: (profile: ProviderProfileDto) => void | Promise<void>;
  onTestMcp?: (serverId?: string) => void | Promise<void>;
  onReloadIntegrations?: () => void | Promise<void>;
}

export function SettingsPage({
  settings,
  tools = [],
  mcpTools = [],
  skills = { skills: [], errors: [] },
  providerTest,
  mcpTest,
  onSaveSettings,
  onTestProvider,
  onTestMcp,
  onReloadIntegrations
}: SettingsPageProps) {
  const [providerForm, setProviderForm] = useState<ProviderProfileDto>(emptyProvider);
  const [mcpForm, setMcpForm] = useState(emptyMcpServer);
  const [skillPath, setSkillPath] = useState("");

  if (!settings) {
    return (
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Settings</h2>
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">Loading settings...</CardContent>
        </Card>
      </section>
    );
  }

  const currentSettings = settings;

  async function save(next: GlobalSettingsDto = currentSettings) {
    await onSaveSettings?.(next);
  }

  function addProvider() {
    if (!providerForm.id || !providerForm.name || !providerForm.baseUrl || !providerForm.model) {
      return;
    }
    const next = {
      ...currentSettings,
      providerProfiles: [
        ...currentSettings.providerProfiles.filter((profile) => profile.id !== providerForm.id),
        providerForm
      ]
    };
    setProviderForm(emptyProvider);
    void save(next);
  }

  function removeProvider(profileId: string) {
    void save({
      ...currentSettings,
      providerProfiles: currentSettings.providerProfiles.filter((profile) => profile.id !== profileId)
    });
  }

  function toggleTool(toolId: string, enabled: boolean) {
    void save({
      ...currentSettings,
      enabledToolIds: toggleValue(currentSettings.enabledToolIds, toolId, enabled)
    });
  }

  function addMcpServer() {
    if (!mcpForm.id || !mcpForm.name) {
      return;
    }
    const server = mcpFormToServer(mcpForm);
    const next = {
      ...currentSettings,
      mcpServers: [...currentSettings.mcpServers.filter((item) => item.id !== server.id), server],
      enabledMcpServerIds: toggleValue(currentSettings.enabledMcpServerIds, server.id, true)
    };
    setMcpForm(emptyMcpServer);
    void save(next);
  }

  function removeMcpServer(serverId: string) {
    void save({
      ...currentSettings,
      mcpServers: currentSettings.mcpServers.filter((server) => server.id !== serverId),
      enabledMcpServerIds: currentSettings.enabledMcpServerIds.filter((id) => id !== serverId)
    });
  }

  function toggleMcpServer(serverId: string, enabled: boolean) {
    void save({
      ...currentSettings,
      enabledMcpServerIds: toggleValue(currentSettings.enabledMcpServerIds, serverId, enabled)
    });
  }

  function addSkillPath() {
    if (!skillPath.trim()) {
      return;
    }
    const path = skillPath.trim();
    const next = {
      ...currentSettings,
      skillPaths: [...new Set([...currentSettings.skillPaths, path])],
      enabledSkillPaths: toggleValue(currentSettings.enabledSkillPaths, path, true)
    };
    setSkillPath("");
    void save(next);
  }

  function removeSkillPath(path: string) {
    void save({
      ...currentSettings,
      skillPaths: currentSettings.skillPaths.filter((item) => item !== path),
      enabledSkillPaths: currentSettings.enabledSkillPaths.filter((item) => item !== path)
    });
  }

  function toggleSkillPath(path: string, enabled: boolean) {
    void save({
      ...currentSettings,
      enabledSkillPaths: toggleValue(currentSettings.enabledSkillPaths, path, enabled)
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Settings</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void onReloadIntegrations?.()}>
            Reload
          </Button>
          <Button onClick={() => void save()}>Save settings</Button>
        </div>
      </div>
      <Tabs defaultValue="providers">
        <TabsList>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="mcp">MCP</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="safety">Safety</TabsTrigger>
        </TabsList>
        <TabsContent value="providers" className="mt-4">
          <div className="grid gap-3">
            {settings.providerProfiles.map((profile) => (
              <Card key={profile.id}>
                <CardHeader>
                  <CardTitle>{profile.name}</CardTitle>
                  <CardDescription>
                    {profile.kind} / {profile.model} / {profile.baseUrl}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-md bg-muted px-2 py-1">
                    {describeProviderCredential(profile.apiKeyEnv)}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => void onTestProvider?.(profile)}>
                    Test provider
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => removeProvider(profile.id)}>
                    Remove
                  </Button>
                </CardContent>
              </Card>
            ))}
            {providerTest ? (
              <Card>
                <CardContent className="p-3 text-sm">
                  {providerTest.ok ? "OK" : "Failed"}: {providerTest.message}
                </CardContent>
              </Card>
            ) : null}
            <Card>
              <CardHeader>
                <CardTitle>Add provider</CardTitle>
                <CardDescription>OpenAI, Anthropic, DeepSeek, or any OpenAI-compatible endpoint</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-3">
                <Input
                  aria-label="Provider id"
                  placeholder="id"
                  value={providerForm.id}
                  onChange={(event) => setProviderForm({ ...providerForm, id: event.target.value })}
                />
                <Input
                  aria-label="Provider name"
                  placeholder="name"
                  value={providerForm.name}
                  onChange={(event) => setProviderForm({ ...providerForm, name: event.target.value })}
                />
                <select
                  aria-label="Provider kind"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={providerForm.kind}
                  onChange={(event) =>
                    setProviderForm({ ...providerForm, kind: event.target.value as ProviderKindDto })
                  }
                >
                  <option value="openai-compatible">OpenAI-compatible</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
                <Input
                  aria-label="Provider base URL"
                  placeholder="base URL"
                  value={providerForm.baseUrl}
                  onChange={(event) => setProviderForm({ ...providerForm, baseUrl: event.target.value })}
                />
                <Input
                  aria-label="Provider model"
                  placeholder="model"
                  value={providerForm.model}
                  onChange={(event) => setProviderForm({ ...providerForm, model: event.target.value })}
                />
	                <Input
	                  aria-label="Provider API key or env var"
	                  placeholder="API key or env var"
	                  value={providerForm.apiKeyEnv}
	                  onChange={(event) => setProviderForm({ ...providerForm, apiKeyEnv: event.target.value })}
	                />
                <Button className="md:col-span-3" onClick={addProvider}>
                  Add provider
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="tools" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2">
            {tools.map((tool) => (
              <Card key={tool.id}>
                <CardContent className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div>
                    <p className="font-medium">{tool.id}</p>
                    <p className="text-muted-foreground">{tool.description}</p>
                  </div>
                  <Switch
                    checked={settings.enabledToolIds.includes(tool.id)}
                    aria-label={tool.id}
                    onCheckedChange={(checked) => toggleTool(tool.id, checked)}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="mcp" className="mt-4">
          <div className="grid gap-3">
            {settings.mcpServers.map((server) => (
              <Card key={server.id}>
                <CardHeader>
                  <CardTitle>{server.name}</CardTitle>
                  <CardDescription>
                    {server.transport} / {server.transport === "http" ? server.url : server.command}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2">
                  <Switch
                    checked={settings.enabledMcpServerIds.includes(server.id)}
                    aria-label={`Enable ${server.id}`}
                    onCheckedChange={(checked) => toggleMcpServer(server.id, checked)}
                  />
                  <Button variant="outline" size="sm" onClick={() => void onTestMcp?.(server.id)}>
                    Test MCP
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => removeMcpServer(server.id)}>
                    Remove
                  </Button>
                </CardContent>
              </Card>
            ))}
            {mcpTest ? (
              <Card>
                <CardContent className="p-3 text-sm">
                  {mcpTest.ok ? "OK" : "Failed"}: {mcpTest.toolCount ?? 0} tools loaded
                </CardContent>
              </Card>
            ) : null}
            <Card>
              <CardHeader>
                <CardTitle>MCP tools</CardTitle>
                <CardDescription>Tools loaded from enabled MCP servers</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm md:grid-cols-2">
                {mcpTools.map((tool) => (
                  <div key={tool.id} className="rounded-md border p-2">
                    <p className="font-medium">{tool.id}</p>
                    <p className="text-muted-foreground">{tool.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Add MCP server</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-3">
                <Input
                  aria-label="MCP server id"
                  placeholder="id"
                  value={mcpForm.id}
                  onChange={(event) => setMcpForm({ ...mcpForm, id: event.target.value })}
                />
                <Input
                  aria-label="MCP server name"
                  placeholder="name"
                  value={mcpForm.name}
                  onChange={(event) => setMcpForm({ ...mcpForm, name: event.target.value })}
                />
                <select
                  aria-label="MCP transport"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={mcpForm.transport}
                  onChange={(event) =>
                    setMcpForm({ ...mcpForm, transport: event.target.value as "stdio" | "http" })
                  }
                >
                  <option value="stdio">stdio</option>
                  <option value="http">http</option>
                </select>
                <Input
                  aria-label="MCP command"
                  placeholder="stdio command"
                  value={mcpForm.command}
                  onChange={(event) => setMcpForm({ ...mcpForm, command: event.target.value })}
                />
                <Input
                  aria-label="MCP URL"
                  placeholder="http url"
                  value={mcpForm.url}
                  onChange={(event) => setMcpForm({ ...mcpForm, url: event.target.value })}
                />
                <Button onClick={addMcpServer}>Add MCP</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="skills" className="mt-4">
          <div className="grid gap-3">
            {settings.skillPaths.map((path) => (
              <Card key={path}>
                <CardContent className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="truncate">{path}</span>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={settings.enabledSkillPaths.includes(path)}
                      aria-label={`Enable ${path}`}
                      onCheckedChange={(checked) => toggleSkillPath(path, checked)}
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeSkillPath(path)}>
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card>
              <CardHeader>
                <CardTitle>Loaded skills</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm md:grid-cols-2">
                {skills.skills.map((skill) => (
                  <div key={skill.path} className="rounded-md border p-2">
                    <p className="font-medium">{skill.name}</p>
                    <p className="text-muted-foreground">{skill.description || "No description"}</p>
                  </div>
                ))}
                {skills.errors.map((error) => (
                  <div key={error.path} className="rounded-md border p-2 text-destructive">
                    {error.path}: {error.message}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Add skill path</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Input
                  aria-label="Skill path"
                  placeholder="/absolute/path/to/skill"
                  value={skillPath}
                  onChange={(event) => setSkillPath(event.target.value)}
                />
                <Button onClick={addSkillPath}>Add skill</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="safety" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Local execution policy</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-3">
              <Input
                aria-label="Command timeout"
                type="number"
                value={settings.commandPolicy.timeoutMs}
                onChange={(event) =>
                  void save({
                    ...settings,
                    commandPolicy: {
                      ...settings.commandPolicy,
                      timeoutMs: Number(event.target.value)
                    }
                  })
                }
              />
              <Input
                aria-label="Command output bytes"
                type="number"
                value={settings.commandPolicy.maxOutputBytes}
                onChange={(event) =>
                  void save({
                    ...settings,
                    commandPolicy: {
                      ...settings.commandPolicy,
                      maxOutputBytes: Number(event.target.value)
                    }
                  })
                }
              />
              <Input
                aria-label="Web response bytes"
                type="number"
                value={settings.webPolicy.maxResponseBytes}
                onChange={(event) =>
                  void save({
                    ...settings,
                    webPolicy: {
                      ...settings.webPolicy,
                      maxResponseBytes: Number(event.target.value)
                    }
                  })
                }
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
