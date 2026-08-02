import { defineConfig } from "tsup";

// A CLI, not a library: one ESM bundle with a shebang, no type declarations
// and no CJS build. Dependencies stay external so npx resolves them normally.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  sourcemap: true,
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
});
