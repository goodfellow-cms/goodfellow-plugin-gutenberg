import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Gutenberg's packages expect a browser's globals, even for their stores.
    environment: "happy-dom",
    // Its packages import JSON without the attribute Node needs, so they go through Vite.
    server: { deps: { inline: [/@wordpress\//] } },
  },
});
