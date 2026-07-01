export type AppRoute = "workspace" | "projects" | "runs" | "artifacts" | "settings";

export const routes: Array<{ id: AppRoute; label: string }> = [
  { id: "workspace", label: "Workspace" },
  { id: "projects", label: "Projects" },
  { id: "runs", label: "Runs" },
  { id: "artifacts", label: "Artifacts" },
  { id: "settings", label: "Settings" }
];
