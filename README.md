# goodfellow-plugin-gutenberg

A [Goodfellow](https://github.com/goodfellow-cms/goodfellow-cms) plugin that will let people edit pages in WordPress's block editor, Gutenberg, in place of Puck. For now it's a prototype: it tries out the two questions step 37 of Goodfellow's roadmap asks before the plugin is built.

## Status

This is a prototype, not a plugin yet. Nothing here is published, and it doesn't plug into the admin panel yet. It works with Goodfellow 0.5.0's published packages, and with the starter and the parish example as `create-goodfellow@0.5.0` bundles them (`sites.ts`), a dev dependency: the tests make each site's description from its own config, as its builds make `goodfellow-site.json`, and read its content from the package. The Next.js starter has the same content and blocks as the starter. Moving to a newer Goodfellow is a matter of updating those versions.

## What the prototype found

### Slots inside a block's own layout

Gutenberg places all of a block's inner blocks in one place, but Goodfellow's blocks can have several slots, each somewhere of its own in the block's layout, such as a Section's content inside its padding or Columns' items in a grid.

What works:

- **Each slot is a block of its own.** Each of the site's blocks is `goodfellow/<name>`, holding one `goodfellow/slot` block per slot (`src/convert.ts`, `src/register.ts`). The slot blocks are locked in place, and their own blocks are free to edit and move.
- **Each slot draws its blocks where it belongs.** The block's HTML marks each slot's place with an empty `<gf-slot data-slot="…">`, and each slot block draws its list of blocks into that place with a React portal (`src/edit.tsx`).
- **Layout comes through.** `display: contents` on the places and the slot blocks lets the block's own grid or flex lay out the blocks in them, so the three Sections in the starter's Columns sit side by side, as on the site.
- **The blocks stay Gutenberg's.** A heading two slots deep can still be selected, shows its settings in the sidebar, and is drawn again when they change.

### Showing blocks without the site's code

The plugin is GPL-licensed, like Gutenberg, so it never bundles the site's blocks. It knows them only through the site's description, `goodfellow-site.json`, which has their fields but not their code. The prototype tries both ways of drawing them.

- **From the render frame's HTML (`BlockRenderer`).** A separate frame that has the site's code draws one block at a time, with Goodfellow's own MIT-licensed renderer (`preparePage()` and `PageContent`), with each slot replaced by a placeholder block. The editor asks it over `postMessage` and puts the HTML in place (`prototype/render.tsx`, `prototype/render-client.ts`). In the plugin, the admin panel's render frame would answer, so the plugin's own frame never loads a block's code. The render frame also gives the editor the site's description, settings and page, as the admin panel would, so the editor never loads the site's files. With the starter's stylesheet compiled by Tailwind (`prototype/site.css`) and `themeToCss()` in Gutenberg's canvas, the page looks as it does on the site (`prototype/results/home.png` after `pnpm check`).
- **From their fields alone (`outlineRenderer()`, `src/outline.ts`).** Each block is drawn as a box with its name and the words in its text fields, and its slots one under another. This needs nothing but the description, so it always works, but nothing looks like the site: Columns' items are stacked, and rich text, images and colors don't show (`home-fields.png`).

**Recommendation:** draw from the render frame, and fall back to fields alone for a block the frame can't draw, or while the frame loads.

### Losing nothing

A page's data goes into Gutenberg and comes back exactly as it was, keys and all: a block's props are kept as one `props` attribute, and nothing is saved as Gutenberg's HTML. This holds for every page, header, footer and template of both sites, in Gutenberg's own data store (`test/round-trip.test.ts`, 29 tests), and in the browser, before and after a change, where the only difference is the prop that was changed.

### What's left for the plugin

- **The plugin itself.** An admin module whose `editor.mount()` (Goodfellow's `PluginEditorSession`) runs this editor in the plugin's frame. It needs a way to ask the admin panel's render frame to draw one block; the editor plugin protocol doesn't have one yet, so that's Goodfellow's part.
- **Fields.** The sidebar edits text, textarea, select, radio and number fields with Gutenberg's own controls (`src/fields.tsx`). Rich text, lists of items, media and the site's own custom fields come next.
- **Gutenberg's styling options** (colors, spacing, typography), kept as Tailwind classes in each block's `className`, as planned.
- **Text edited in place,** for fields marked `contentEditable`, such as a heading's text.
- **Fonts.** The canvas doesn't load the theme's Google Fonts yet, so headings fall back to the computer's fonts.

## Trying it

```sh
pnpm install
pnpm test        # the data's round trip through Gutenberg's data store
pnpm typecheck
pnpm dev         # the editor at http://localhost:5173/index.html (add ?draw=fields to draw from fields alone)
pnpm check       # the browser checks, with screenshots in prototype/results/
```

`pnpm check` uses Playwright as the computer has it. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use a Chromium that's already installed.

## License

GPL-2.0-or-later, like Gutenberg, whose code the plugin will bundle (see `LICENSE`). Sites that use it keep their own licenses: the plugin never bundles a site's blocks, and draws them through a separate frame over messages.
