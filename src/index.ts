/**
 * Gutenberg for Goodfellow: WordPress's block editor as a page editor of its
 * own, which each person editing the site can choose in place of Puck in the
 * editor's header. Content stays in Goodfellow's files as it is, so the plugin
 * can be added to or removed from a site at any time.
 */
import type { GoodfellowPlugin } from "@goodfellow-cms/core";

/** The plugin's version, which `package.json` has too. */
export const VERSION = "0.2.0";

/** The plugin, for a site's config's `plugins`. */
export function gutenberg(): GoodfellowPlugin {
  return {
    name: "goodfellow-plugin-gutenberg",
    title: "Gutenberg",
    version: VERSION,
    description: "Edit pages in WordPress's block editor, Gutenberg, in place of Puck.",
    // Its frame reaches nothing outside the site: blocks are drawn by the site's own code.
    permissions: {},
    admin: "goodfellow-plugin-gutenberg/admin",
    editor: { title: "Gutenberg", kinds: ["page", "header", "footer", "template"] },
  };
}

export default gutenberg();
