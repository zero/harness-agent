import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { resolveProjectPath, type Project } from "@harness-agent/core";

export interface CreateSkillSkeletonInput {
  name: string;
  description: string;
  triggers: string[];
}

export interface CreateSkillSkeletonResult {
  relativePath: string;
}

export function createSkillSkeleton(
  project: Project,
  input: CreateSkillSkeletonInput
): CreateSkillSkeletonResult {
  const relativePath = `skills/${input.name}`;
  const skillRoot = resolveProjectPath(project, relativePath);
  const skillFile = join(skillRoot, "SKILL.md");
  mkdirSync(join(skillRoot, "scripts"), { recursive: true });
  mkdirSync(join(skillRoot, "templates"), { recursive: true });
  mkdirSync(join(skillRoot, "assets"), { recursive: true });
  mkdirSync(dirname(skillFile), { recursive: true });
  writeFileSync(
    skillFile,
    [
      "---",
      `name: ${input.name}`,
      `description: ${input.description}`,
      "triggers:",
      ...input.triggers.map((trigger) => `  - ${trigger}`),
      "---",
      "",
      `# ${input.name}`,
      "",
      input.description,
      ""
    ].join("\n")
  );

  return { relativePath };
}
