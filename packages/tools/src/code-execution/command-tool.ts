import { spawn } from "node:child_process";

import { resolveProjectPath, type Project } from "@harness-agent/core";

export interface ExecuteProjectCommandInput {
  command: string;
  cwd?: string;
  timeoutMs: number;
  maxOutputBytes: number;
  env?: Record<string, string>;
}

export interface ExecuteProjectCommandResult {
  exitCode: number | null;
  signal?: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
}

function appendWithLimit(current: string, next: Buffer, limit: number): [string, boolean] {
  if (current.length >= limit) {
    return [current, true];
  }

  const incoming = next.toString("utf8");
  const combined = current + incoming;
  if (combined.length > limit) {
    return [combined.slice(0, limit), true];
  }

  return [combined, false];
}

export async function executeProjectCommand(
  project: Project,
  input: ExecuteProjectCommandInput
): Promise<ExecuteProjectCommandResult> {
  const cwd = resolveProjectPath(project, input.cwd ?? ".");

  return new Promise((resolvePromise) => {
    let stdout = "";
    let stderr = "";
    let truncated = false;
    let timedOut = false;

    const child = spawn(input.command, {
      cwd,
      shell: true,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        ...input.env
      }
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, input.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      const [nextStdout, didTruncate] = appendWithLimit(
        stdout,
        chunk,
        input.maxOutputBytes
      );
      stdout = nextStdout;
      truncated = truncated || didTruncate;
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const [nextStderr, didTruncate] = appendWithLimit(
        stderr,
        chunk,
        input.maxOutputBytes
      );
      stderr = nextStderr;
      truncated = truncated || didTruncate;
    });

    child.on("close", (exitCode, signal) => {
      clearTimeout(timeout);
      resolvePromise({
        exitCode,
        signal,
        stdout,
        stderr,
        timedOut,
        truncated
      });
    });
  });
}
