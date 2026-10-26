import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { SITE_PACKAGES, siteDir } from "../sites.js";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The starter, as `create-goodfellow` bundles it, for the render frame.
  resolve: { alias: { "@starter": siteDir("starter") }, dedupe: SITE_PACKAGES },
  server: { fs: { allow: [".."] } },
  build: { rollupOptions: { input: { index: "index.html", render: "render.html" } } },
});
