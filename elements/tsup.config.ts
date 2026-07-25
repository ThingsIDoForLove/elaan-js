import { defineConfig } from "tsup";

export default defineConfig([
  // Package entry: core stays external so apps dedupe it.
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ["@elaanio/core"],
  },
  // Standalone browser build for <script src="…"> / CDN use: core is bundled in
  // (a browser can't resolve a bare "@elaanio/core" specifier) and the custom
  // elements self-register on load.
  {
    entry: { "elaan-elements": "src/global.ts" },
    format: ["iife"],
    globalName: "Elaan",
    platform: "browser",
    sourcemap: true,
    minify: true,
    clean: false,
    outExtension: () => ({ js: ".global.js" }),
  },
]);
