import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createSkillSkeleton } from "./skill-creator-tool";
import { createTempProject } from "../test-utils";

describe("skill creator tool", () => {
  it("creates a skill skeleton under the project workspace", () => {
    const project = createTempProject();
    const result = createSkillSkeleton(project, {
      name: "report-writer",
      description: "Write local reports",
      triggers: ["report", "doc"]
    });

    expect(result.relativePath).toBe("skills/report-writer");
    expect(existsSync(join(project.workspacePath, "skills/report-writer/scripts"))).toBe(true);
    expect(existsSync(join(project.workspacePath, "skills/report-writer/templates"))).toBe(true);
    expect(existsSync(join(project.workspacePath, "skills/report-writer/assets"))).toBe(true);
    expect(
      readFileSync(join(project.workspacePath, "skills/report-writer/SKILL.md"), "utf8")
    ).toContain("description: Write local reports");
  });
});
