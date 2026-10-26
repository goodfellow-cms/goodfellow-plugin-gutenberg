# goodfellow-plugin-gutenberg

A [Goodfellow](https://github.com/goodfellow-cms/goodfellow-cms) plugin that lets people edit pages in WordPress's block editor, Gutenberg, in place of Puck: each person editing the site chooses **Gutenberg** or the standard editor in the editor's header, and the admin panel remembers it in their browser. Content stays in Goodfellow's files as it is, so the plugin can be added to or removed from a site at any time.

## Status

An early version, not published yet. It works with Goodfellow 0.6.0, for pages, the header and footer, and collections' templates:

- **Every block of the site** is a Gutenberg block of its own, made from the site's description, drawn by the site's own code (`session.draw()`) with the site's styles (`session.styles()`), and drawn from its fields alone where the site's code can't draw it.
- **Slots** are Gutenberg's inner blocks, each drawn where it belongs in its block's layout. Blocks added in Gutenberg start with the site's defaults for them, and each gets an id of its own, as do the copies Gutenberg duplicates.
- **The canvas** is drawn in the plugin's own frame rather than an iframe of Gutenberg's, since the frame is sandboxed already and its policy allows no frames, with the site's styles scoped to it.
- **The sidebar** has the page's settings and the selected block's: text, textarea, select, radio and number fields.
- **The admin panel's header** works as with Puck: Undo and Redo, unsaved changes, Publish, drafts, and the AI assistant, which gets the selected block.

`pnpm check:site` tries it in a real site: a starter site from `create-goodfellow`, with the plugin installed from its packed files, under `goodfellow dev`, where it chooses Gutenberg, changes a heading, undoes and redoes it, publishes, and reads the change from the page's file.

## Using it

```sh
npm install goodfellow-plugin-gutenberg
```

Then add it to the site's `goodfellow.config.tsx`:

```tsx
import gutenberg from "goodfellow-plugin-gutenberg";

export default defineConfig({
  // ...
  plugins: [...installedPlugins, gutenberg],
});
```

The plugin asks for nothing: its frame reaches no other address, reads no files and holds no secrets.

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

- **From the render frame's HTML (`BlockRenderer`).** A separate frame that has the site's code draws one block at a time, with Goodfellow's own MIT-licensed renderer (`preparePage()` and `PageContent`), with each slot left as an empty `<gf-slot>`. The editor asks it over `postMessage` and puts the HTML in place (`prototype/render.tsx`, `prototype/render-client.ts`). In the plugin, Goodfellow's `session.draw(block)` answers instead, from the admin panel's frame with the site's code, in the same form, so a `BlockRenderer` is `{ render: session.draw }` and the plugin's own frame never loads a block's code. The render frame also gives the editor the site's description, settings and page, as the admin panel would, so the editor never loads the site's files. With the starter's stylesheet compiled by Tailwind (`prototype/site.css`) and `themeToCss()` in Gutenberg's canvas, the page looks as it does on the site (`prototype/results/home.png` after `pnpm check`).
- **From their fields alone (`outlineRenderer()`, `src/outline.ts`).** Each block is drawn as a box with its name and the words in its text fields, and its slots one under another. This needs nothing but the description, so it always works, but nothing looks like the site: Columns' items are stacked, and rich text, images and colors don't show (`home-fields.png`).

**Recommendation:** draw from the render frame, and fall back to fields alone for a block the frame can't draw, or while the frame loads.

### Losing nothing

A page's data goes into Gutenberg and comes back exactly as it was, keys and all: a block's props are kept as one `props` attribute, and nothing is saved as Gutenberg's HTML. This holds for every page, header, footer and template of both sites, in Gutenberg's own data store (`test/round-trip.test.ts`, 29 tests), and in the browser, before and after a change, where the only difference is the prop that was changed.

### What's left for the plugin

- **Fields.** Rich text, lists of items, media (with the media library's chooser), and the site's own custom fields, which the sidebar doesn't edit yet.
- **Gutenberg's styling options** (colors, spacing, typography), kept as Tailwind classes in each block's `className`, compiled in the canvas from `session.styles()`'s Tailwind source.
- **Text edited in place,** for fields marked `contentEditable`, such as a heading's text.
- **Pasted HTML** as the site's blocks, with `htmlBlocks()` from `@goodfellow-cms/core/wordpress`.
- **Fonts.** The plugin loads the theme's Google Fonts where Goodfellow gives them (`session.styles().fonts`, after 0.6.0, goodfellow-cms/goodfellow-cms#113), whose editor plugins' frames may load them; with 0.6.0, headings fall back to the computer's fonts.
- **Rendering while it loads.** Each block is drawn once the site's code answers, rather than from its fields first.

## Trying it

```sh
pnpm install
pnpm test        # the data's round trip through Gutenberg's data store, and the editor's history and ids
pnpm typecheck
pnpm build       # dist/ and goodfellow-plugin.json
pnpm check:site  # the plugin in a starter site under goodfellow dev, with screenshots in .site-check/
pnpm dev         # the prototype's editor at http://localhost:5173/index.html (add ?draw=fields to draw from fields alone)
pnpm check       # the prototype's browser checks, with screenshots in prototype/results/
```

`pnpm check:site` makes the site in `.site/` the first time, which needs npm to reach the registry. Both checks use Playwright as the computer has it; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use a Chromium that's already installed.

## License

GPL-2.0-or-later, like Gutenberg, whose code the plugin will bundle (see `LICENSE`). Sites that use it keep their own licenses: the plugin never bundles a site's blocks, and draws them through a separate frame over messages.
