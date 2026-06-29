import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  listProjectDirectory,
  readProjectFile,
  searchProjectFiles,
  writeProjectFile
} from "./filesystem-tool";
import { createTempProject } from "../test-utils";

describe("filesystem tool", () => {
  it("reads, writes, lists, and searches inside a project workspace", () => {
    const project = createTempProject();

    writeProjectFile(project, "src/sample.txt", "alpha\nbeta\nalpha");

    expect(readProjectFile(project, "src/sample.txt")).toBe("alpha\nbeta\nalpha");
    expect(listProjectDirectory(project, "src").entries).toContain("sample.txt");
    expect(searchProjectFiles(project, "alpha")).toEqual([
      {
        path: "src/sample.txt",
        line: 1,
        text: "alpha"
      },
      {
        path: "src/sample.txt",
        line: 3,
        text: "alpha"
      }
    ]);
    expect(readFileSync(join(project.workspacePath, "src/sample.txt"), "utf8")).toBe(
      "alpha\nbeta\nalpha"
    );
  });

  it("rejects paths outside the project workspace", () => {
    const project = createTempProject();
    const outsidePath = join(project.workspacePath, "../outside.txt");
    writeFileSync(outsidePath, "secret");

    expect(() => readProjectFile(project, "../outside.txt")).toThrow(
      "outside project workspace"
    );
    expect(() => writeProjectFile(project, "../outside.txt", "nope")).toThrow(
      "outside project workspace"
    );
  });
});
