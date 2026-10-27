/**
 * Blocks drawn as Goodfellow's admin panel draws them for an editor plugin's
 * `session.draw()`, in its frame with the site's code: in the page they're
 * on, each slot left as an empty `<gf-slot>`. The same steps as Goodfellow's
 * own (MIT-licensed) `drawBlock()`, which isn't exported, for tests here.
 */
import { allPages, type GoodfellowConfig, loadSiteContent, type Page, type SiteContent } from "@goodfellow-cms/core";
import { fileSystemSource } from "@goodfellow-cms/core/node";
import { createPuckConfigs, PageContent, preparePage } from "@goodfellow-cms/react";
import type { ComponentConfig, ComponentData } from "@puckeditor/core";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

const SLOT_BLOCK = "__goodfellow_drawn_slot__";

const drawnSlot = {
  fields: { slot: { type: "text" } },
  render: ({ slot }: { slot?: unknown }) => createElement("gf-slot", { "data-slot": String(slot ?? "") }),
} as unknown as ComponentConfig;

/** Draws blocks of a site in its home page, as `session.draw()` does. */
export async function siteDrawer(config: GoodfellowConfig, root: string) {
  const content: SiteContent = await loadSiteContent(fileSystemSource(root));
  const configs = createPuckConfigs({ ...config, blocks: { ...config.blocks, [SLOT_BLOCK]: drawnSlot } });
  const home = allPages(content).find((page) => page.path === "/") as Page;
  return async function draw(block: ComponentData): Promise<string> {
    const fields = (configs.page.components[block.type]?.fields ?? {}) as Record<string, { type?: string }>;
    const places = Object.entries(fields)
      .filter(([, field]) => field.type === "slot")
      .map(([slot]) => [slot, [{ type: SLOT_BLOCK, props: { id: `${String(block.props.id)}:${slot}`, slot } }]]);
    const drawn = { ...block, props: { ...block.props, ...Object.fromEntries(places) } };
    const page = { ...home, content: { ...home.content, data: { root: home.content.data.root, content: [drawn] } } } as Page;
    const prepared = await preparePage({ ...configs }, content, page);
    const container = document.createElement("div");
    const reactRoot = createRoot(container);
    try {
      flushSync(() =>
        reactRoot.render(
          createElement(PageContent, {
            site: { ...prepared.site, credits: [] },
            pageConfig: prepared.pageConfig,
            page: prepared.data,
          }),
        ),
      );
      const main = container.querySelector("main");
      const zone = main?.children.length === 1 ? main.firstElementChild : null;
      const bare = zone?.tagName === "DIV" && zone.attributes.length === 0;
      return (bare ? zone : main)?.innerHTML ?? "";
    } finally {
      reactRoot.unmount();
    }
  };
}
