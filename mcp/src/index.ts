/**
 * Elaan MCP server.
 *
 * Exposes the Elaan management API to an AI assistant over stdio, so the tedious
 * parts of an integration — creating notification types, writing templates for
 * three channels, setting up brands, then working out why a message did not
 * arrive — can be done in the editor instead of by hand in the console.
 *
 *   {
 *     "mcpServers": {
 *       "elaan": {
 *         "command": "npx",
 *         "args": ["-y", "@elaanio/mcp"],
 *         "env": { "ELAAN_API_KEY": "sk_..." }
 *       }
 *     }
 *   }
 *
 * The service key is read from the environment and never taken as a tool
 * argument: arguments are model-visible and end up in transcripts.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ElaanClient } from "./client.js";
import { registerTools } from "./tools.js";

async function main() {
  const apiKey = process.env.ELAAN_API_KEY;

  // An unexpanded `${VAR}` counts as unset. Claude Code's .mcp.json supports
  // ${ELAAN_API_KEY} expansion, but when the variable is missing it passes the
  // literal "${ELAAN_API_KEY}" text through rather than an empty string. That
  // is truthy, so a plain falsy check would start the server and let every
  // call fail with an unexplained 401 — which is the first thing anyone
  // installing the plugin would hit.
  const unexpanded = apiKey !== undefined && /^\$\{[^}]*\}$/.test(apiKey.trim());

  if (!apiKey || unexpanded) {
    // stderr, not stdout: stdout is the MCP transport and anything written
    // there that is not a protocol message breaks the session.
    console.error(
      (unexpanded
        ? `ELAAN_API_KEY was passed through unexpanded as "${apiKey}", which means\n` +
          "the environment variable it refers to is not set.\n\n"
        : "ELAAN_API_KEY is not set.\n\n") +
        "Create a service key in the Elaan console (console.elaan.io), then either\n" +
        "export it before starting your editor:\n\n" +
        '  export ELAAN_API_KEY="sk_..."\n\n' +
        "or put the value directly in the server's env block:\n\n" +
        '  "env": { "ELAAN_API_KEY": "sk_..." }\n',
    );
    process.exit(1);
  }

  const server = new McpServer({
    name: "elaan",
    version: "0.1.0",
  });

  registerTools(server, new ElaanClient(apiKey));

  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error("Fatal error starting the Elaan MCP server:", error);
  process.exit(1);
});
