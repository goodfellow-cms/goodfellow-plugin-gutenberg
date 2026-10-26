/**
 * Goodfellow's starter and its parish example, as `create-goodfellow` bundles
 * them, which the tests use as the sites to edit. The
 * Next.js starter has the same content and blocks as the starter.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

export const SITES = ["starter", "parish"] as const;
export type SiteName = (typeof SITES)[number];

/** Where a site's files are, in the installed `create-goodfellow` package. */
export function siteDir(site: SiteName): string {
  const pkg = createRequire(import.meta.url).resolve("create-goodfellow/package.json");
  return join(dirname(pkg), "templates", site);
}

/**
 * Packages the sites' own code imports, which pnpm doesn't make reachable from
 * inside `create-goodfellow`, so they're found from this repository: one copy
 * of each, the versions `package.json` names.
 */
export const SITE_PACKAGES = [
  "@goodfellow-cms/blocks",
  "@goodfellow-cms/core",
  "@goodfellow-cms/react",
  "@puckeditor/core",
  "react",
  "react-dom",
];
