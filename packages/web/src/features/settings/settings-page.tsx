import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tools = ["filesystem.read", "command.execute", "web.search", "artifact.write"];

export function SettingsPage() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Settings</h2>
      <Tabs defaultValue="providers">
        <TabsList>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="mcp">MCP</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="safety">Safety</TabsTrigger>
        </TabsList>
        <TabsContent value="providers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>DeepSeek</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              OpenAI-compatible preset
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tools" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2">
            {tools.map((tool) => (
              <Card key={tool}>
                <CardContent className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span>{tool}</span>
                  <Switch checked aria-label={tool} />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="mcp" className="mt-4">
          <Card>
            <CardContent className="p-3 text-sm">stdio and HTTP servers</CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="skills" className="mt-4">
          <Card>
            <CardContent className="p-3 text-sm">Skill paths</CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="safety" className="mt-4">
          <Card>
            <CardContent className="p-3 text-sm">Timeouts and output limits</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
