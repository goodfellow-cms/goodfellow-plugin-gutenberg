/**
 * The prototype's editor: the starter's home page in Gutenberg's block editor,
 * every block drawn as the site draws it (`src/edit.tsx`), with the page's
 * data read back through `fromGutenberg()` for the checks (`check.mjs`). Like
 * the plugin, it never loads the site's files or blocks' code: the render
 * frame gives it the site's description.
 */
import "@wordpress/components/build-style/style.css";
import "@wordpress/block-editor/build-style/style.css";
import { themeToCss } from "@goodfellow-cms/core";
import {
  BlockCanvas,
  BlockEditorProvider,
  BlockInspector,
  BlockTools,
} from "@wordpress/block-editor";
import contentCss from "@wordpress/block-editor/build-style/content.css?raw";
import type { Block as BlockInstance } from "@wordpress/blocks";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { fromGutenberg, toGutenberg } from "../src/convert.js";
import { type BlockRenderer, blockEditors } from "../src/edit.js";
import { blockNames } from "../src/names.js";
import { outlineRenderer } from "../src/outline.js";
import { registerBlocks } from "../src/register.js";
import editorCss from "../src/editor.css?raw";
import { renderFrame } from "./render-client.js";
import siteCss from "./site.css?inline";

// The render frame stands in for the admin panel: it opens the site, and draws its blocks.
const frame = renderFrame(new URL("./render.html", import.meta.url).href);
const { description: site, settings, content } = await frame.opened;
const names = blockNames(site);
// `?draw=fields` draws blocks from their fields alone; otherwise the render frame draws them as the site does.
const fieldsAlone = new URLSearchParams(location.search).get("draw") === "fields";
const renderer: BlockRenderer = fieldsAlone ? outlineRenderer(site) : frame.renderer;
registerBlocks(site, blockEditors(site, names, renderer));

// The site's CSS, and its theme's colors and fonts, as its pages have them.
const siteStyles = [{ css: siteCss }, { css: themeToCss(settings.theme) }];

// What the editor last handed back, as a plugin would publish it.
let latest: BlockInstance[] = toGutenberg(content, site, names);

function Editor() {
  const [blocks, setStateBlocks] = useState<BlockInstance[]>(latest);
  const setBlocks = (next: BlockInstance[]) => {
    latest = next;
    setStateBlocks(next);
  };
  return (
    <BlockEditorProvider value={blocks} onInput={setBlocks} onChange={setBlocks} settings={{}}>
      <div className="prototype">
        <div className="prototype-canvas">
          <BlockTools>
            <BlockCanvas height="100%" styles={[{ css: contentCss }, ...(fieldsAlone ? [] : siteStyles), { css: editorCss }]} />
          </BlockTools>
        </div>
        <aside className="prototype-sidebar">
          <BlockInspector />
        </aside>
      </div>
    </BlockEditorProvider>
  );
}

// For the checks: the page's data as it is now, back in Goodfellow's terms.
Object.assign(window, {
  prototype: {
    original: content,
    data: () => fromGutenberg(latest, site, names),
  },
});

const root = document.getElementById("editor");
if (root) createRoot(root).render(<Editor />);
