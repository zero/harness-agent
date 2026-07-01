import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { JsonFileStore } from "./json-store";
import { createTempDataDir } from "../test-utils";

describe("JsonFileStore", () => {
  it("persists JSON values to disk", () => {
    const dataDir = createTempDataDir();
    const path = join(dataDir, "settings.json");
    const store = new JsonFileStore(path, { count: 0 });

    expect(store.get()).toEqual({ count: 0 });
    store.set({ count: 2 });

    expect(new JsonFileStore(path, { count: 0 }).get()).toEqual({ count: 2 });
  });
});
