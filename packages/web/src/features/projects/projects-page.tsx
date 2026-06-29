import { useState } from "react";

import type { ProjectDto } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface ProjectsPageProps {
  projects?: ProjectDto[];
  selectedProjectId?: string;
  onCreateProject?: (input: { name: string; workspacePath: string }) => void | Promise<void>;
  onSelectProject?: (projectId: string) => void;
}

export function ProjectsPage({
  projects = [],
  selectedProjectId,
  onCreateProject,
  onSelectProject
}: ProjectsPageProps) {
  const [name, setName] = useState("");
  const [workspacePath, setWorkspacePath] = useState("");

  async function createProject() {
    if (!name.trim() || !workspacePath.trim()) {
      return;
    }
    await onCreateProject?.({ name: name.trim(), workspacePath: workspacePath.trim() });
    setName("");
    setWorkspacePath("");
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Projects</h2>
          <p className="text-sm text-muted-foreground">Local workspace boundaries</p>
        </div>
        <Button onClick={createProject}>Create project</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New project</CardTitle>
          <CardDescription>Workspace path</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Input
            aria-label="Project name"
            placeholder="Project name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            aria-label="Workspace path"
            placeholder="/path/to/workspace"
            value={workspacePath}
            onChange={(event) => setWorkspacePath(event.target.value)}
          />
          <Button variant="outline" onClick={createProject}>
            Save
          </Button>
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {projects.map((project) => (
          <button key={project.id} className="text-left" onClick={() => onSelectProject?.(project.id)}>
            <Card className={project.id === selectedProjectId ? "border-primary" : undefined}>
            <CardHeader>
              <CardTitle>{project.name}</CardTitle>
              <CardDescription>{project.workspacePath}</CardDescription>
            </CardHeader>
          </Card>
          </button>
        ))}
      </div>
    </section>
  );
}
