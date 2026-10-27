# goodfellow-plugin-gutenberg

A [Goodfellow](https://github.com/goodfellow-cms/goodfellow-cms) plugin that lets people edit pages in WordPress's block editor, Gutenberg, in place of Puck: each person editing the site chooses **Gutenberg** or the standard editor in the editor's header, and the admin panel remembers it in their browser. Content stays in Goodfellow's files as it is, so the plugin can be added to or removed from a site at any time.

## Status

An early version, not published yet. It works with Goodfellow 0.6.0, for pages, the header and footer, and collections' templates:

- **Every block of the site** is a Gutenberg block of its own, made from the site's description, drawn by the site's own code (`session.draw()`) with the site's styles (`session.styles()`), and drawn from its fields alone where the site's code can't draw it.
- **Slots** are Gutenberg's inner blocks, each drawn where it belongs in its block's layout. Blocks added in Gutenberg start with the site's defaults for them, and each gets an id of its own, as do the copies Gutenberg duplicates.
- **The canvas** is drawn in the plugin's own frame rather than an iframe of Gutenberg's, since the frame is sandboxed already and its policy allows no frames, with the site's styles scoped to it.
- **Text is edited where it shows,** for the fields Puck edits in place too (`contentEditable`), such as a heading's text, a button's label or a block of rich text, with the block's toolbar for rich text's bold, italic, links (to the site's pages or anywhere), headings and lists.
- **The sidebar** has the page's settings, with how a link to the page looks when it's shared, and the selected block's: text, choices, numbers, rich text, media from the media library, lists of items, groups of fields and tables. Fields only the site's code can draw are named, with where to change them.
- **Pasted HTML** becomes the site's blocks, after the block selected, through Goodfellow's own conversion (`htmlBlocks()`, which its WordPress import uses), and blocks copied in Gutenberg are pasted with their slots' blocks.
- **The admin panel's header** works as with Puck: Undo and Redo, unsaved changes, Publish, drafts, and the AI assistant, which gets the selected block.

`pnpm check:site` tries it in a real site: a starter site from `create-goodfellow`, with the plugin installed from its packed files, under `goodfellow dev`, where it chooses Gutenberg, changes a heading in the sidebar, undoes and redoes it, types in the heading where it shows, makes a word of rich text bold, pastes HTML, publishes, and reads the changes from the page's file.

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

## How it works

### Slots inside a block's own layout

Gutenberg places all of a block's inner blocks in one place, but Goodfellow's blocks can have several slots, each somewhere of its own in the block's layout, such as a Section's content inside its padding or a Grid's items side by side.

- **Each slot is a block of its own.** Each of the site's blocks is `goodfellow/<name>`, holding one `goodfellow/slot` block per slot (`src/convert.ts`, `src/register.ts`). The slot blocks are locked in place, and their own blocks are free to edit and move.
- **Each slot draws its blocks where it belongs.** The block's HTML marks each slot's place with an empty `<gf-slot data-slot="…">`, and each slot block draws its list of blocks into that place with a React portal (`src/edit.tsx`).
- **Layout comes through.** `display: contents` on the places and the slot blocks lets the block's own grid or flex lay out the blocks in them, so the three Sections in the starter's Grid sit side by side, as on the site.
- **The blocks stay Gutenberg's.** A heading two slots deep can still be selected, shows its settings in the sidebar, and is drawn again when they change.

### Drawing blocks without the site's code

The plugin is GPL-licensed, like Gutenberg, so it never bundles the site's blocks. It knows them only through the site's description, `goodfellow-site.json`, which has their fields but not their code. It draws them in two ways:

- **By the site's own code (`session.draw()`).** The admin panel's frame that has the site's code draws one block at a time, with Goodfellow's own MIT-licensed renderer, each slot left as an empty `<gf-slot>`, and the plugin puts the HTML in place (`sessionRenderer()` in `src/admin.tsx`). With the site's stylesheets and theme from `session.styles()`, scoped to Gutenberg's canvas, the page looks as it does on the site, and the plugin's own frame never loads a block's code.
- **From their fields alone (`outlineRenderer()`, `src/outline.ts`),** for a block the site's code can't draw. Each block is drawn as a box with its name and the words in its text fields, and its slots one under another. This needs nothing but the description, so it always works, but nothing looks like the site: a Grid's items are stacked, and rich text, images and colors don't show.

### Losing nothing

A page's data goes into Gutenberg and comes back exactly as it was, keys and all: a block's props are kept as one `props` attribute, and nothing is saved as Gutenberg's HTML. This holds for every page, header, footer and template of both sites, in Gutenberg's own data store (`test/round-trip.test.ts`, 29 tests), and in a real site, before and after a change, where the only difference is the prop that was changed.

### Text edited where it shows

The plugin can't tell where a block puts a field's text, since it has none of the blocks' code. So each field Puck edits in place is drawn with a marker in place of its value, letters and digits that no renderer escapes or splits, and wherever the marker comes out in the drawn HTML becomes the element the text is edited in: the heading itself, a button's label inside its link, or a block of rich text's whole element, so its paragraphs keep the site's styles (`src/in-place.ts`). Copies of the marker elsewhere, such as in an attribute, get the text itself. Typing never draws the block again, since the drawing only ever has the marker. A block that changes its text before showing it, cutting it short say, loses the marker, and that field is edited in the sidebar only. Rich text keeps only what Puck's rich text editor makes (`src/rich-text.ts`), and the site sanitizes it again when it shows it.

### What's left for the plugin

- **Gutenberg's styling options** (colors, spacing, typography), kept as Tailwind classes in each block's `className`, compiled in the canvas from `session.styles()`'s Tailwind source.
- **Images just uploaded** show in the sidebar, but blocks on the canvas show only media the site already has, until it's published.
- **Fonts.** The plugin loads the theme's Google Fonts where Goodfellow gives them (`session.styles().fonts`, after 0.6.0, goodfellow-cms/goodfellow-cms#113), whose editor plugins' frames may load them; with 0.6.0, headings fall back to the computer's fonts.
- **Rendering while it loads.** Each block is drawn once the site's code answers, rather than from its fields first.

## Trying it

```sh
pnpm install
pnpm test        # the data's round trip through Gutenberg's data store, and the editor's history and ids
pnpm typecheck
pnpm build       # dist/ and goodfellow-plugin.json
pnpm check:site  # the plugin in a starter site under goodfellow dev, with screenshots in .site-check/
```

`pnpm check:site` makes the site in `.site/` the first time, which needs npm to reach the registry. It uses Playwright as the computer has it; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use a Chromium that's already installed.

## License

GPL-2.0-or-later, like Gutenberg, whose code the plugin uses (see `LICENSE`). Sites that use it keep their own licenses: the plugin never bundles a site's blocks, and draws them through a separate frame over messages.
