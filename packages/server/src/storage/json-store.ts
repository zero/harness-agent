import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export class JsonFileStore<T> {
  constructor(
    private readonly path: string,
    private readonly defaultValue: T
  ) {}

  get(): T {
    if (!existsSync(this.path)) {
      return this.defaultValue;
    }

    return JSON.parse(readFileSync(this.path, "utf8")) as T;
  }

  set(value: T): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, `${JSON.stringify(value, null, 2)}\n`);
  }
}
