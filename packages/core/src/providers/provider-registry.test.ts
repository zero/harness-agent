import { describe, expect, it } from "vitest";

import { ProviderRegistry } from "./provider-registry";
import type { LlmProvider, ProviderEvent, ProviderRequest } from "./provider-types";

function provider(id: string): LlmProvider {
  return {
    id,
    async *complete(_request: ProviderRequest): AsyncIterable<ProviderEvent> {
      yield { type: "message.delta", text: "ok" };
    }
  };
}

describe("ProviderRegistry", () => {
  it("resolves providers by id", () => {
    const registry = new ProviderRegistry([provider("openai")]);

    expect(registry.get("openai").id).toBe("openai");
  });

  it("rejects unknown provider ids", () => {
    const registry = new ProviderRegistry([]);

    expect(() => registry.get("missing")).toThrow("Provider not found: missing");
  });
});
