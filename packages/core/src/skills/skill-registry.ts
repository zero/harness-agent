import { readFileSync } from "node:fs";
import { basename, join } from "node:path";

export interface Skill {
  name: string;
  description: string;
  path: string;
  triggers: string[];
  instructions: string;
}

function parseSkillMarkdown(path: string, markdown: string): Skill {
  const lines = markdown.split(/\r?\n/);
  const frontmatter: string[] = [];
  let bodyStart = 0;

  if (lines[0] === "---") {
    for (let index = 1; index < lines.length; index += 1) {
      if (lines[index] === "---") {
        bodyStart = index + 1;
        break;
      }
      frontmatter.push(lines[index] ?? "");
    }
  }

  let name = basename(path);
  let description = "";
  const triggers: string[] = [];
  let readingTriggers = false;

  for (const line of frontmatter) {
    if (line.startsWith("name:")) {
      name = line.slice("name:".length).trim();
      readingTriggers = false;
      continue;
    }

    if (line.startsWith("description:")) {
      description = line.slice("description:".length).trim();
      readingTriggers = false;
      continue;
    }

    if (line.startsWith("triggers:")) {
      readingTriggers = true;
      continue;
    }

    if (readingTriggers && line.trim().startsWith("-")) {
      triggers.push(line.trim().slice(1).trim());
      continue;
    }

    if (!line.startsWith(" ")) {
      readingTriggers = false;
    }
  }

  return {
    name,
    description,
    path,
    triggers,
    instructions: lines.slice(bodyStart).join("\n").trim()
  };
}

export class SkillRegistry {
  private constructor(private readonly skills: Skill[]) {}

  static load(skillPaths: string[]): SkillRegistry {
    const skills = skillPaths.map((skillPath) => {
      const markdown = readFileSync(join(skillPath, "SKILL.md"), "utf8");
      return parseSkillMarkdown(skillPath, markdown);
    });

    return new SkillRegistry(skills);
  }

  list(): Skill[] {
    return [...this.skills];
  }

  match(text: string): Skill[] {
    const normalized = text.toLowerCase();

    return this.skills.filter((skill) => {
      const haystack = [skill.name, skill.description, ...skill.triggers]
        .join(" ")
        .toLowerCase();
      return haystack
        .split(/\s+/)
        .filter(Boolean)
        .some((token) => normalized.includes(token));
    });
  }
}
