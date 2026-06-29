import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SettingsPage } from "./settings-page";

describe("SettingsPage", () => {
  it("renders provider, tool, MCP, skill, and safety settings", () => {
    const html = renderToStaticMarkup(<SettingsPage />);

    expect(html).toContain("Providers");
    expect(html).toContain("DeepSeek");
    expect(html).toContain("Tools");
    expect(html).toContain("MCP");
    expect(html).toContain("Skills");
    expect(html).toContain("Safety");
  });
});
