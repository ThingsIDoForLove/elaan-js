import { defineConfig } from "tsup";

export default defineConfig({
  // Three entry points, not one. `web-push` and `service-worker` touch
  // browser-only globals (`navigator.serviceWorker`, the worker's `self`), and
  // `@elaanio/react-native` imports this package — so they must be separately
  // importable rather than reachable from the main entry, which React Native
  // evaluates.
  entry: ["src/index.ts", "src/web-push.ts", "src/service-worker.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
});
