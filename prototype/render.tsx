/**
 * The prototype's render frame: Goodfellow's own renderer, with the site's
 * blocks' code, which the Gutenberg plugin never loads. It stands in for the
 * admin panel, which gives the editor the site's description, settings and
 * page, and draws one block at a time as an editor plugin's `session.draw()`
 * does: as the site draws it, each slot left as an empty `<gf-slot>`.
 */
import { defineConfig, loadSiteContent, type Page } from "@goodfellow-cms/core";
import { createPuckConfigs, describeSite, PageContent, preparePage } from "@goodfellow-cms/react";
import type { ComponentData } from "@puckeditor/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import site from "@starter/goodfellow.config.tsx";
import { SLOT_ELEMENT } from "../src/edit.js";
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

/** The block drawn in each slot's place, as Goodfellow's drawing has one of its own. */
const SLOT_PLACEHOLDER = "__goodfellow_drawn_slot__";

const configs = createPuckConfigs(
  defineConfig({
    blocks: {
      ...site.blocks,
      [SLOT_PLACEHOLDER]: {
        fields: { slot: { type: "text" } },
        // An element of its own, not one React knows, so the editor finds it in the HTML.
        render: ({ slot }) => createElement(SLOT_ELEMENT, { "data-slot": String(slot) }),
      },
    },
    categories: site.categories,
  }),
);

/** The block with each of its slots holding only the block that marks its place. */
function withSlotPlaces(block: ComponentData): ComponentData {
  const fields = (configs.page.components[block.type]?.fields ?? {}) as Record<string, { type?: string }>;
  const places = Object.entries(fields)
    .filter(([, field]) => field.type === "slot")
    .map(([slot]) => [slot, [{ type: SLOT_PLACEHOLDER, props: { id: `${String(block.props.id)}:${slot}`, slot } }]]);
  return { ...block, props: { ...block.props, ...Object.fromEntries(places) } };
}

async function draw(block: ComponentData): Promise<string> {
  const page = {
    path: "/",
    file: "",
    content: { version: 1, data: { root: { props: { title: "" } }, content: [withSlotPlaces(block)] } },
  } as unknown as Page;
  const prepared = await preparePage(configs, await content, page);
  const html = renderToStaticMarkup(
    <PageContent site={prepared.site} pageConfig={prepared.pageConfig} page={prepared.data} />,
  );
  // The block itself, without the page's <main> around it, or the element Puck puts a page's blocks in.
  const inside = /^<main[^>]*>([\s\S]*)<\/main>$/.exec(html)?.[1] ?? html;
  return /^<div>([\s\S]*)<\/div>$/.exec(inside)?.[1] ?? inside;
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
