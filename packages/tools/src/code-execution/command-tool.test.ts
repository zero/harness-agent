import { describe, expect, it } from "vitest";

import { executeProjectCommand } from "./command-tool";
import { createTempProject } from "../test-utils";

describe("command execution tool", () => {
  it("executes commands in the project workspace", async () => {
    const project = createTempProject();

    const result = await executeProjectCommand(project, {
      command: "pwd",
      timeoutMs: 1000,
      maxOutputBytes: 2048
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(project.workspacePath);
    expect(result.timedOut).toBe(false);
  });

  it("reports non-zero exits and truncates output", async () => {
    const project = createTempProject();

    const result = await executeProjectCommand(project, {
      command: "printf 'abcdef'; exit 7",
      timeoutMs: 1000,
      maxOutputBytes: 3
    });

    expect(result.exitCode).toBe(7);
    expect(result.stdout).toBe("abc");
    expect(result.truncated).toBe(true);
  });

  it("reports the signal when a command is terminated by a signal", async () => {
    const project = createTempProject();

    const result = await executeProjectCommand(project, {
      command: "kill -PIPE $$",
      timeoutMs: 1000,
      maxOutputBytes: 2048
    });

    expect(result.exitCode).toBeNull();
    expect(result.signal).toBe("SIGPIPE");
  });

  it("rejects cwd outside the project workspace", async () => {
    const project = createTempProject();

    await expect(
      executeProjectCommand(project, {
        command: "pwd",
        cwd: "..",
        timeoutMs: 1000,
        maxOutputBytes: 2048
      })
    ).rejects.toThrow("outside project workspace");
  });
});
