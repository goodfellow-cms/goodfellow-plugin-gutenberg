# goodfellow-plugin-gutenberg

## 0.2.1

### Patch Changes

- fdd69eb: Links to Goodfellow's GitHub Sponsors page from npm.
- ce20ce9: Blocks that choose their settings in the site's code, such as the Comments block, show in the sidebar the settings the site's code gives for what's chosen, where the admin panel can say (Goodfellow 0.9 or later), so Disqus and Garrul comments no longer offer Giscus's settings.
- 29a9227: Uses the site's own React rather than a copy of its own: React and React DOM are peer dependencies, as they are for WordPress's packages, so the plugin's frame never bundles two. Drawn blocks show the site's smaller copies of photos (`srcset`) from a site in a folder, as they do the photo itself. Tidying text that has private-use characters of its own, such as an icon font's, keeps the selection where it was. A block that couldn't be drawn shows its name as text. The repository checks its packages for security advisories, and Dependabot keeps them up to date.

## 0.2.0

### Minor Changes

- 77bc5ce: Gutenberg's Hide option, in a block's Options menu, hides it on phones, tablets or computers, kept as the classes Goodfellow's Style setting writes for its Hide on (`max-sm:hidden`, `sm:max-lg:hidden`, `lg:hidden`), with Tailwind's breakpoints as Gutenberg's sizes of screen. Blocks hidden that way in Puck show as hidden in Gutenberg, and the other way round.
  
  Forms in the editor, such as the Hide and Rename dialogs and the link form, now work: the frame's sandbox submits no forms, so the plugin sends their submit itself when their button is clicked or Enter is pressed.

### Patch Changes

- Leaves showing the site's media to Goodfellow where it does it itself in editor plugins' frames (`session.showsMedia`), which also shows pictures uploaded but not yet published, and media a storage plugin such as S3 keeps. On earlier Goodfellow releases the plugin still adds the site's folder to media addresses itself.
- 76c1bed: Rich text pasted from Word or a web page keeps more: a table's rows become paragraphs of their cells' words rather than all of them run together, numbered lists keep where they start and which way they count, and code keeps its language. Pictures pasted into text, which it can't hold, are left out with a note saying to paste them outside the text, where they become blocks. A picture pasted from the clipboard as a file, which did nothing, opens the media library to upload it, and becomes an Image block once it's chosen.
- 14a1dc2: Blocks pasted as Gutenberg's block markup keep only the props the site's blocks have, each as its field takes it, with rich text cleaned as typed rich text is, since markup on the clipboard can come from any web page. Rich text is also cleaned whenever it's put in place to edit, in the canvas and the settings sidebar, whoever wrote it.

## 0.1.1

### Patch Changes

- 43a6f27: Images show on sites in a folder of their domain, such as GitHub Pages' `example.github.io/site/`: on the canvas, in the sidebar's media fields and in the link preview. Before, they were looked for at the root of the domain.
