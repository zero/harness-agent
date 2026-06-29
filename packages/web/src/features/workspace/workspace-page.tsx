import { FileText, Play, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export function WorkspacePage() {
  return (
    <section className="grid min-h-[calc(100vh-8rem)] gap-4 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
      <aside className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Session history</h2>
        {["Inspect workspace", "Draft report", "Create deck"].map((title) => (
          <Card key={title}>
            <CardContent className="p-3 text-sm">{title}</CardContent>
          </Card>
        ))}
      </aside>
      <main className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Ask the local agent</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Textarea placeholder="Ask for a local task" />
            <div className="flex justify-end">
              <Button>
                <Play data-icon="inline-start" />
                Run
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <article className="rounded-md bg-muted p-3 text-sm">
              <h3 className="font-semibold">Assistant</h3>
              <p>Generated a concise workspace summary and created an artifact.</p>
            </article>
            <details className="rounded-md border p-3 text-sm" open>
              <summary className="flex items-center gap-2 font-medium">
                <Terminal data-icon="inline-start" />
                filesystem.list
              </summary>
              <pre className="mt-2 overflow-auto text-xs">{"{ \"path\": \".\" }"}</pre>
            </details>
            <Card>
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <span className="flex items-center gap-2 text-sm">
                  <FileText data-icon="inline-start" />
                  report.pdf
                </span>
                <Button variant="outline" size="sm">Preview</Button>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </main>
      <aside>
        <Tabs defaultValue="artifacts">
          <TabsList>
            <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>
          <TabsContent value="artifacts" className="mt-3">
            <Card>
              <CardContent className="p-3 text-sm">report.pdf</CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="files" className="mt-3">
            <Card>
              <CardContent className="p-3 text-sm">README.md</CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="events" className="mt-3">
            <Card>
              <CardContent className="p-3 text-sm">session.completed</CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </aside>
    </section>
  );
}
