/** The starter's config, which the render frame loads through the `@starter` alias (`vite.config.ts`). */
declare module "@starter/goodfellow.config.tsx" {
  import type { GoodfellowConfig } from "@goodfellow-cms/core";

  const config: GoodfellowConfig;
  export default config;
}
