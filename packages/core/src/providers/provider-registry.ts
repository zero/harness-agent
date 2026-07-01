import type { LlmProvider } from "./provider-types";

export class ProviderRegistry {
  private readonly providers = new Map<string, LlmProvider>();

  constructor(providers: LlmProvider[] = []) {
    for (const provider of providers) {
      this.register(provider);
    }
  }

  register(provider: LlmProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): LlmProvider {
    const provider = this.providers.get(id);

    if (!provider) {
      throw new Error(`Provider not found: ${id}`);
    }

    return provider;
  }

  list(): LlmProvider[] {
    return [...this.providers.values()];
  }
}
