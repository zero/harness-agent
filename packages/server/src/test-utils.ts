import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function createTempDataDir(): string {
  return realpathSync(mkdtempSync(join(tmpdir(), "harness-server-data-")));
}

export function createTempWorkspace(): string {
  return realpathSync(mkdtempSync(join(tmpdir(), "harness-server-workspace-")));
}
