import { describe, expect, it } from "vitest";

import { App } from "./app";

describe("App", () => {
  it("is a React component", () => {
    expect(App).toBeTypeOf("function");
  });
});
