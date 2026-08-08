import { defineConfig } from "tsup";
export default defineConfig({
  // Two entries: the main one must stay free of browser-only imports so React
  // Native can bundle it. See src/browser-push.ts.
  entry: ["src/index.ts", "src/browser-push.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "react-native", "@elaanio/core", "@elaanio/react-core"],
});
