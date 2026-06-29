import { FolderKanban, History, Layers, Settings, TerminalSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProjectsPage } from "@/features/projects/projects-page";
import { WorkspacePage } from "@/features/workspace/workspace-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { RunsPage } from "@/features/runs/runs-page";
import { ArtifactsPage } from "@/features/artifacts/artifacts-page";
import { routes, type AppRoute } from "./routes";

const icons: Record<AppRoute, typeof TerminalSquare> = {
  workspace: TerminalSquare,
  projects: FolderKanban,
  runs: History,
  artifacts: Layers,
  settings: Settings
};

function routeContent(route: AppRoute) {
  if (route === "projects") return <ProjectsPage />;
  if (route === "runs") return <RunsPage />;
  if (route === "artifacts") return <ArtifactsPage />;
  if (route === "settings") return <SettingsPage />;
  return <WorkspacePage />;
}

export function App({ route = "workspace" }: { route?: AppRoute }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <h1 className="text-lg font-semibold">Harness Agent</h1>
          <nav className="flex flex-wrap gap-1">
            {routes.map((item) => {
              const Icon = icons[item.id];
              return (
                <Button
                  key={item.id}
                  variant={item.id === route ? "secondary" : "ghost"}
                  size="sm"
                >
                  <Icon data-icon="inline-start" />
                  {item.label}
                </Button>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-4">{routeContent(route)}</main>
    </div>
  );
}
