import { useState } from "react";
import { FolderOpen, Trash2 } from "lucide-react";

import type { ProjectDto } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface ProjectsPageProps {
  projects?: ProjectDto[];
  selectedProjectId?: string;
  onCreateProject?: (input: { name: string; workspacePath: string }) => void | Promise<void>;
  onPickWorkspace?: () => Promise<string | undefined>;
  onSelectProject?: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void | Promise<void>;
}

export function ProjectsPage({
  projects = [],
  selectedProjectId,
  onCreateProject,
  onPickWorkspace,
  onSelectProject,
  onDeleteProject
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

  async function pickWorkspace() {
    const selectedPath = await onPickWorkspace?.();
    if (selectedPath) {
      setWorkspacePath(selectedPath);
    }
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
        <CardContent className="grid gap-3 md:grid-cols-[minmax(12rem,1fr)_minmax(16rem,1.4fr)_auto_auto]">
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
          <Button className="whitespace-nowrap" variant="outline" onClick={() => void pickWorkspace()}>
            <FolderOpen data-icon="inline-start" />
            Browse workspace
          </Button>
          <Button variant="outline" onClick={createProject}>
            Save
          </Button>
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {projects.map((project) => (
          <Card key={project.id} className={project.id === selectedProjectId ? "border-primary" : undefined}>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <button
                className="min-w-0 text-left"
                onClick={() => onSelectProject?.(project.id)}
              >
                <CardTitle>{project.name}</CardTitle>
                <CardDescription>{project.workspacePath}</CardDescription>
              </button>
              {onDeleteProject ? (
                <Button
                  variant="ghost"
                  size="icon"
                  title={`Delete ${project.name}`}
                  aria-label={`Delete ${project.name}`}
                  onClick={() => void onDeleteProject(project.id)}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}
