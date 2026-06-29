import type { ProjectDto } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ProjectsPage({ projects = [] }: { projects?: ProjectDto[] }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Projects</h2>
          <p className="text-sm text-muted-foreground">Local workspace boundaries</p>
        </div>
        <Button>Create project</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New project</CardTitle>
          <CardDescription>Workspace path</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Input aria-label="Project name" placeholder="Project name" />
          <Input aria-label="Workspace path" placeholder="/path/to/workspace" />
          <Button variant="outline">Select</Button>
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {projects.map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <CardTitle>{project.name}</CardTitle>
              <CardDescription>{project.workspacePath}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}
