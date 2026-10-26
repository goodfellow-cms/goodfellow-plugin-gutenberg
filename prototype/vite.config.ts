import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // The fixtures are beside the prototype, in the repository's test folder.
  server: { fs: { allow: [".."] } },
  build: { rollupOptions: { input: { index: "index.html", render: "render.html" } } },
});
