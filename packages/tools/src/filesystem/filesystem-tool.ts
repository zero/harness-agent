import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";

import { resolveProjectPath, type Project } from "@harness-agent/core";

export interface DirectoryListing {
  path: string;
  entries: string[];
}

export interface SearchResult {
  path: string;
  line: number;
  text: string;
}

export function readProjectFile(project: Project, path: string): string {
  return readFileSync(resolveProjectPath(project, path), "utf8");
}

export function writeProjectFile(project: Project, path: string, content: string): void {
  const resolved = resolveProjectPath(project, path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, content);
}

export function listProjectDirectory(project: Project, path: string): DirectoryListing {
  const resolved = resolveProjectPath(project, path);
  return {
    path,
    entries: readdirSync(resolved).sort()
  };
}

function collectFiles(project: Project, path: string): string[] {
  const resolved = resolveProjectPath(project, path);
  const stat = statSync(resolved);

  if (stat.isFile()) {
    return [resolved];
  }

  return readdirSync(resolved, { withFileTypes: true }).flatMap((entry) => {
    const childPath = `${path.replace(/\/$/, "")}/${entry.name}`.replace(/^\.\//, "");
    if (entry.isDirectory()) {
      return collectFiles(project, childPath);
    }
    if (entry.isFile()) {
      return [resolveProjectPath(project, childPath)];
    }
    return [];
  });
}

export function searchProjectFiles(project: Project, query: string): SearchResult[] {
  const files = collectFiles(project, ".");
  const results: SearchResult[] = [];

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((lineText, index) => {
      if (lineText.includes(query)) {
        results.push({
          path: relative(project.workspacePath, file),
          line: index + 1,
          text: lineText
        });
      }
    });
  }

  return results;
}
