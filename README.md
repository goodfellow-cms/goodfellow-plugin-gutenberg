# goodfellow-plugin-gutenberg

A [Goodfellow](https://github.com/goodfellow-cms/goodfellow-cms) plugin that lets people edit pages in WordPress's block editor, Gutenberg, in place of Puck: each person editing the site chooses **Gutenberg** or the standard editor in the editor's header, and the admin panel remembers it in their browser. Content stays in Goodfellow's files as it is, so the plugin can be added to or removed from a site at any time.

## Status

An early version, ready to publish to npm. It works with Goodfellow 0.6.0 and later, for pages, the header and footer, and collections' templates:

- **Every block of the site** is a Gutenberg block of its own, made from the site's description, drawn by the site's own code (`session.draw()`) with the site's styles (`session.styles()`), and drawn from its fields alone where the site's code can't draw it.
- **Slots** are Gutenberg's inner blocks, each drawn where it belongs in its block's layout. A block with one slot, such as a Section, holds the slot's blocks itself; one with several has a block for each slot. Blocks added in Gutenberg start with the site's defaults for them, and each gets an id of its own, as do the copies Gutenberg duplicates.
- **The canvas** is drawn in the plugin's own frame rather than an iframe of Gutenberg's, since the frame is sandboxed already and its policy allows no frames, with the site's styles scoped to it. The frame stays the size the admin panel gives it: only the canvas and the sidebars scroll.
- **Adding blocks** as in WordPress: **Add a block** above the canvas opens Gutenberg's inserter, the **+** shows between two blocks the pointer is near (`src/inserters.ts`, since the site draws its blocks flush against each other, where Gutenberg would look for a gap), "Type / to choose a block" at the end of the page adds the site's Text, and typing "/" on a line of its own in text lists the blocks to put in its place, or after the text where it has other words (`src/slash.tsx`). Enter at the end of a one-line field, such as a heading's, starts an empty Text after the block.
- **The document overview** above the canvas lists every block, nested as they are, with each slot of a block that has several named as its field is.
- **Transform to** turns one of the site's blocks into another where its words are all either needs, such as Text into a Heading and back, keeping its CSS classes (`src/transforms.ts`). Blocks with slots, or a link or file of their own, such as a button, aren't offered, and Gutenberg's preview of a transform isn't shown, since it's drawn in a frame of its own that the plugin's frame can't load.
- **Gutenberg's own light look**, whatever the admin panel's mode: its text stays Gutenberg's dark gray on its white sidebars and menus.
- **Blocks' icons** are the ones the site's description gives them (Goodfellow's `withIcon()`, from Goodfellow 0.7.0), read by the plugin itself, which keeps only plain shapes (`src/icons.tsx`), and WordPress's icon for a block where there's none.
- **Text is edited where it shows,** for the fields Puck edits in place too (`contentEditable`), such as a heading's text, a button's label or a block of rich text, with the block's toolbar for rich text's bold, italic, links (to the site's pages or anywhere), headings and lists. What the browser's editing wraps text in to keep its look, such as Chrome's `<span style>` when it makes a list, comes out of the text as it's edited (`tidyRichText()` in `src/rich-text.ts`), and Enter starts a new line of the text rather than a new block.
- **The sidebar** has the page's settings, with how a link to the page looks when it's shared, and the selected block's: text, choices, numbers, rich text, media from the media library, lists of items, groups of fields and tables. Fields only the site's code can draw are named, with where to change them.
- **Gutenberg's styling options** in the Styles tab, for every block with a `className` field: the theme's colors for text and background, Tailwind's font sizes, padding and margins, and rounded corners, kept as Tailwind classes in the block's `className`, which Puck shows and edits too.
- **Hide,** in the block's Options menu, hides it on phones (Gutenberg's Mobile, narrower than 640px), tablets (640px to 1023px) or computers (Desktop), kept as the classes Puck's Style setting writes for its Hide on (`max-sm:hidden`, `sm:max-lg:hidden`, `lg:hidden`). "Omit from published content" hides it on every size of screen; the block is still in the page's HTML, hidden, rather than left out as WordPress leaves it out.
- **Forms in the frame,** such as Gutenberg's Hide and Rename dialogs and the link form, work although the frame's sandbox submits none: the plugin sends a form's submit itself when its button is clicked or Enter is pressed (`src/forms.ts`).
- **Pasted HTML** becomes the site's blocks, after the block selected, through Goodfellow's own conversion (`htmlBlocks()`, which its WordPress import uses), and blocks copied in Gutenberg are pasted with their slots' blocks, keeping only the props the site's blocks have. Pasted into rich text, a table's rows become paragraphs of their cells' words, numbered lists keep where they start, code keeps its language, and pictures, which text can't hold, are left out with a note to paste them outside the text instead. A picture on the clipboard as a file opens the media library to upload it, since only the admin panel uploads, and becomes an Image block once it's chosen.
- **The admin panel's header** works as with Puck: Undo and Redo, unsaved changes, Publish, drafts, and the AI assistant, which gets the selected block.

`pnpm check:site` tries it in a real site: a starter site from `create-goodfellow`, with the plugin installed from its packed files, under `goodfellow dev`, where it chooses Gutenberg, changes a heading in the sidebar, undoes and redoes it, types in the heading where it shows, makes a word of rich text bold, links words by typing an address and pressing Enter, gives the heading a theme color in the Styles tab, hides it on phones with Gutenberg's Hide option, pastes HTML, publishes, and reads the changes from the page's file. Then it opens the document overview and the inserter, finds the + between two blocks, makes lists of rich text, pastes a picture into text, and adds blocks by typing "/".

## Using it

**From the admin panel,** where the site installs plugins there (at a checked admin address, or with a token broker): **Site Settings → Plugins**, search for Gutenberg, read what it asks for (an editor for pages, the header and footer, and templates, and nothing else), then **Install**. Once the site has rebuilt, the editor's header offers **Gutenberg** beside the standard editor.

**In code,** on any site:

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

The plugin asks for nothing: its frame reaches no other address, reads no files and holds no secrets. Before installing, the Plugins screen reviews the code of the plugin and the packages it needs, at most 40 of them; Gutenberg needs many more, so it lists the rest as not read.

## How it works

### Slots inside a block's own layout

Gutenberg places all of a block's inner blocks in one place, but Goodfellow's blocks can have several slots, each somewhere of its own in the block's layout, such as a Section's content inside its padding or a Grid's items side by side.

- **Each slot is a block of its own,** where a block has several. Each of the site's blocks is `goodfellow/<name>`, holding one `goodfellow/slot` block per slot (`src/convert.ts`, `src/register.ts`). The slot blocks are locked in place, and their own blocks are free to edit and move. A block with only one slot (`onlySlot()`) holds its blocks itself, drawn into the slot's place the same way.
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

### Styling options as Tailwind classes

Goodfellow's blocks are styled with Tailwind, and every block keeps extra classes in its `className` prop, so what's chosen in Gutenberg's Styles tab is kept there as Tailwind classes, and content needs nowhere new to keep it (`src/styles.ts`):

- **The theme's colors** are Gutenberg's palette, by the names the admin panel's Theme tab gives them, as `text-primary`, `bg-muted` and the rest, so they follow the theme when it changes. A color of an editor's own is an arbitrary class, `text-[#123456]`.
- **Font sizes, spacing and rounded corners** are Tailwind's scales (`text-2xl`, `p-4`, `my-8`, `rounded-lg`), offered as Gutenberg's presets, and other values are arbitrary classes, such as `p-[13px]`. Values that could break out of a class are refused.
- **Hiding on sizes of screen** is Gutenberg's Hide option, with Tailwind's breakpoints as Gutenberg's (`VIEWPORT_BREAKPOINTS`), written as the fewest of Goodfellow's hide classes, never plain `hidden`, which blocks use with `dark:block`. The editor draws a hidden block without them, since Gutenberg hides it itself where the editor is that size, and shows it while it's selected.
- **Classes Gutenberg doesn't write**, such as `md:` variants or a theme's classes, stay as they are, as Gutenberg's additional CSS classes, and a page opened and published without a change keeps its classes exactly as they were.
- **New classes show at once.** The site's CSS has only the classes its last build saw, so the plugin compiles the site's Tailwind source (`session.styles().tailwind`) in its frame with `@tailwindcss/browser`, as Goodfellow's own editor does, and scopes the output to the canvas with the site's other styles (`src/tailwind.ts`). The site's next build compiles them as usual.

### What's left for the plugin

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

## Publishing a version

Every change that reaches the published plugin needs a changeset: run `pnpm changeset`, choose patch, minor or major, and describe the change for the plugin's users. It writes a file in `.changeset/`, which goes in the same pull request.

1. Run `pnpm release:version`, which turns the changesets into a new `version` in `package.json` and an entry in `CHANGELOG.md` (`changeset version`), and puts the same version in `src/index.ts`'s `VERSION`, which a test keeps the same. Commit what it changes. Every release needs a new version: npm never lets one be published twice.
2. Run `pnpm check:site`, which CI doesn't, since it makes a site from npm and drives it in a browser.
3. Publish a GitHub release whose tag is `v` and the version, such as `v0.1.0`.
4. [`publish.yml`](.github/workflows/publish.yml) checks the plugin again and stages it on npm with [provenance](https://docs.npmjs.com/generating-provenance-statements), which the Plugins screen shows owners: which repository and commit it was built from. A staged version isn't published: nobody can install it until a maintainer approves it. The run's page lists the digest of the file it staged.
5. Approve it from your computer, with npm 11.15 or later (`npm install --global npm@11`), signed in to npm (`npm login`): `npm stage list goodfellow-plugin-gutenberg` lists what's waiting, with each one's id and digest. Compare the digest with the run's, then run `npm stage approve <id>`, which asks for your two-factor code and publishes it. To throw a staged version away instead, run `npm stage reject <id>`.

The workflow signs in to npm with [trusted publishing](https://docs.npmjs.com/trusted-publishers), so the repository holds no npm token, and it may only stage versions, so nothing reaches npm without a maintainer's two-factor authentication. Set it up once, with npm 11.15 or later:

```sh
npm trust github goodfellow-plugin-gutenberg --file publish.yml --repo goodfellow-cms/goodfellow-plugin-gutenberg --allow-stage-publish --yes
```

Without `--allow-publish`, npm refuses `npm publish` from the workflow. A package has one trusted publisher: if it already has one that may publish, find its id with `npm trust list goodfellow-plugin-gutenberg` and remove it first with `npm trust revoke --id <id> goodfellow-plugin-gutenberg`. npm drops a trusted publisher that hasn't staged anything within 2 days of being added, so add it shortly before a release. Then choose **Require two-factor authentication and disallow tokens** under the package's **Settings → Publishing access**. The package's first version has to be published from a computer (`pnpm build && npm publish --access public`), since trusted publishing is set up in a package's settings. The Plugins screen offers a release once it's three days old.

`peerDependencies` names the Goodfellow releases it works with, as a range on `@goodfellow-cms/core` (`>=0.6.0 <1.0.0`). A release is offered only to sites on a Goodfellow release in that range, and Goodfellow's Updates screen warns owners when a newer one is outside it, so narrow it in a new version if a Goodfellow release breaks the plugin.

## License

GPL-2.0-or-later, like Gutenberg, whose code the plugin uses (see `LICENSE`). Sites that use it keep their own licenses: the plugin never bundles a site's blocks, and draws them through a separate frame over messages.
