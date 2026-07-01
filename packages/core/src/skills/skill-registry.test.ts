import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SkillRegistry } from "./skill-registry";

describe("SkillRegistry", () => {
  it("loads skill metadata and matches trigger text", () => {
    const root = mkdtempSync(join(tmpdir(), "harness-skills-"));
    const skillPath = join(root, "writer");
    mkdirSync(skillPath);
    writeFileSync(
      join(skillPath, "SKILL.md"),
      [
        "---",
        "name: writer",
        "description: Draft reports",
        "triggers:",
        "  - report",
        "---",
        "",
        "# Writer",
        "",
        "Use concise sections."
      ].join("\n")
    );

    const registry = SkillRegistry.load([skillPath]);

    expect(registry.list()).toMatchObject([
      {
        name: "writer",
        description: "Draft reports",
        path: skillPath
      }
    ]);
    expect(registry.match("please create a report")).toHaveLength(1);
  });
});
