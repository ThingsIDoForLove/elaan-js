import { defineConfig } from "tsup";
import pkg from "./package.json" with { type: "json" };

// A CLI, not a library: one ESM bundle with a shebang, no type declarations
// and no CJS build. Dependencies stay external so npx resolves them normally.
//
// __PKG_VERSION__ is substituted from package.json at build time. It used to be
// a hardcoded string in index.ts, which silently kept reporting 0.1.0 after the
// package moved to 0.1.1 -- and serverInfo.version is the first thing you look
// at when debugging which build someone is running.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  sourcemap: true,
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
  define: { __PKG_VERSION__: JSON.stringify(pkg.version) },
});
