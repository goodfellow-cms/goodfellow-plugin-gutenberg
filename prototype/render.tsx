/**
 * The prototype's render frame: Goodfellow's own renderer, with the site's
 * blocks' code, which the Gutenberg plugin never loads. It stands in for the
 * admin panel, which gives the editor the site's description, settings and
 * page, and answers its requests to draw one block, its slots left as
 * placeholders, as the site would.
 */
import { defineConfig, loadSiteContent, type Page } from "@goodfellow-cms/core";
import { createPuckConfigs, describeSite, PageContent, preparePage } from "@goodfellow-cms/react";
import type { ComponentData } from "@puckeditor/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import site from "@starter/goodfellow.config.tsx";
import { SLOT_PLACEHOLDER } from "../src/edit.js";
import type { OpenedSite } from "./render-client.js";

// The starter's content files, by their paths in the site.
const files = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("@starter/content/**/*", { query: "?raw", import: "default", eager: true }),
  ).map(([file, text]) => [file.slice(file.indexOf("content/")), text]),
);
const content = loadSiteContent({
  read: async (path) => files[path],
  list: async (dir) => Object.keys(files).filter((file) => file.startsWith(`${dir}/`)),
});

const configs = createPuckConfigs(
  defineConfig({
    blocks: {
      ...site.blocks,
      [SLOT_PLACEHOLDER]: {
        fields: { slot: { type: "text" } },
        // An element of its own, not one React knows, so the editor finds it in the HTML.
        render: ({ slot }) => createElement("gf-slot", { "data-slot": String(slot) }),
      },
    },
    categories: site.categories,
  }),
);

async function draw(block: ComponentData): Promise<string> {
  const page = {
    path: "/",
    file: "",
    content: { version: 1, data: { root: { props: { title: "" } }, content: [block] } },
  } as unknown as Page;
  const prepared = await preparePage(configs, await content, page);
  const html = renderToStaticMarkup(
    <PageContent site={prepared.site} pageConfig={prepared.pageConfig} page={prepared.data} />,
  );
  // The block itself, without the page's <main> around it.
  const inside = /^<main[^>]*>([\s\S]*)<\/main>$/.exec(html);
  return inside?.[1] ?? html;
}

window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  const { id, block } = event.data as { id: number; block: ComponentData };
  draw(block).then(
    (html) => window.parent.postMessage({ id, html }, "*"),
    (error: Error) => window.parent.postMessage({ id, error: error.message }, "*"),
  );
});
// What the admin panel would give the plugin's editor: the site's description, not its code.
content.then((loaded) => {
  const home = loaded.pages.find((page) => page.path === "/");
  const opened: OpenedSite = {
    description: describeSite(site),
    settings: loaded.settings,
    content: (home?.content.data.content ?? []) as ComponentData[],
  };
  window.parent.postMessage({ ready: true, site: opened }, "*");
});

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "gf-slot": { "data-slot": string };
    }
  }
}
