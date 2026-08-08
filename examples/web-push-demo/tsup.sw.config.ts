import { defineConfig } from "tsup";

// The service worker is bundled separately from the app, into `public/` so it is
// served from the origin root — a worker's default scope is its own directory, so
// one served from `/assets/` could only ever control `/assets/`.
//
// `iife` so the output is a classic script with no import/export syntax left,
// which is what a non-module service worker requires. Registering the untranspiled
// source with `{ type: "module" }` instead works in Chrome and not in Firefox.
export default defineConfig({
  entry: { sw: "src/sw.ts" },
  outDir: "public",
  format: ["iife"],
  outExtension: () => ({ js: ".js" }),
  target: "es2020",
  dts: false,
  sourcemap: true,
  clean: false,
});
