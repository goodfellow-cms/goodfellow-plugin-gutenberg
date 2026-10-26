import { defineConfig } from "vitest/config";
import { SITE_PACKAGES } from "./sites.js";

export default defineConfig({
  resolve: { dedupe: SITE_PACKAGES },
  test: {
    environment: "happy-dom",
    // Gutenberg's packages import JSON without import attributes, which Node refuses, and the sites' configs are
    // TypeScript inside `create-goodfellow`, so Vite loads both.
    server: { deps: { inline: [/@wordpress\//, /create-goodfellow/] } },
  },
});
