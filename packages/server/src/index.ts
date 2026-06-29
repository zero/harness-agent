import { serve } from "@hono/node-server";
import { pathToFileURL } from "node:url";

import { createServerApp } from "./app";

export const serverPackageName = "@harness-agent/server";

export { createServerApp };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 8787);
  const dataDir = process.env.HARNESS_AGENT_DATA_DIR ?? ".harness-agent-local";
  const app = createServerApp({ dataDir });
  serve({ fetch: app.fetch, port });
  console.log(`Harness Agent server listening on http://127.0.0.1:${port}`);
}
