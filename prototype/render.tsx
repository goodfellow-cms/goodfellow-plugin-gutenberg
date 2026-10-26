/**
 * The prototype's render frame: Goodfellow's own renderer, with the site's
 * blocks' code, which the Gutenberg plugin never loads. It stands in for the
 * admin panel's render frame, and answers the editor's requests to draw one
 * block, its slots left as placeholders, as the site would.
 */
import { blocks, categories } from "@goodfellow-cms/blocks";
import { defineConfig, loadSiteContent, type Page } from "@goodfellow-cms/core";
import { createPuckConfigs, PageContent, preparePage } from "@goodfellow-cms/react";
import type { ComponentData } from "@puckeditor/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SLOT_PLACEHOLDER } from "../src/edit.js";

const files = import.meta.glob<string>("../test/fixtures/starter/content/**/*", {
  query: "?raw",
  import: "default",
  eager: true,
});
const prefix = "../test/fixtures/starter/";
const content = loadSiteContent({
  read: async (path) => files[prefix + path],
  list: async (dir) =>
    Object.keys(files)
      .map((file) => file.slice(prefix.length))
      .filter((file) => file.startsWith(`${dir}/`)),
});

const configs = createPuckConfigs(
  defineConfig({
    blocks: {
      ...blocks,
      [SLOT_PLACEHOLDER]: {
        fields: { slot: { type: "text" } },
        // An element of its own, not one React knows, so the editor finds it in the HTML.
        render: ({ slot }) => createElement("gf-slot", { "data-slot": String(slot) }),
      },
    },
    categories,
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
window.parent.postMessage({ ready: true }, "*");

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "gf-slot": { "data-slot": string };
    }
  }
}
