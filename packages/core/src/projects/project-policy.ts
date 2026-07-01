import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import type { Project } from "./project-types";

function normalizeExistingOrPlannedPath(path: string): string {
  if (existsSync(path)) {
    return realpathSync(path);
  }

  let current = dirname(path);
  while (!existsSync(current) && dirname(current) !== current) {
    current = dirname(current);
  }

  if (existsSync(current)) {
    const existingRoot = realpathSync(current);
    const plannedTail = relative(current, path);
    return resolve(existingRoot, plannedTail);
  }

  return resolve(path);
}

export function isPathInsideProject(project: Project, candidatePath: string): boolean {
  const workspacePath = normalizeExistingOrPlannedPath(project.workspacePath);
  const normalizedCandidate = normalizeExistingOrPlannedPath(candidatePath);
  const pathFromWorkspace = relative(workspacePath, normalizedCandidate);

  return (
    pathFromWorkspace === "" ||
    (!pathFromWorkspace.startsWith("..") && !isAbsolute(pathFromWorkspace))
  );
}

export function resolveProjectPath(project: Project, requestedPath: string): string {
  const workspacePath = normalizeExistingOrPlannedPath(project.workspacePath);
  const candidatePath = isAbsolute(requestedPath)
    ? requestedPath
    : resolve(workspacePath, requestedPath);

  if (!isPathInsideProject(project, candidatePath)) {
    throw new Error(`Path is outside project workspace: ${requestedPath}`);
  }

  return normalizeExistingOrPlannedPath(candidatePath);
}
