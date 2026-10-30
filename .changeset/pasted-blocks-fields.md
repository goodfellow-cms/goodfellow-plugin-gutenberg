---
"goodfellow-plugin-gutenberg": patch
---

Blocks pasted as Gutenberg's block markup keep only the props the site's blocks have, each as its field takes it, with rich text cleaned as typed rich text is, since markup on the clipboard can come from any web page. Rich text is also cleaned whenever it's put in place to edit, in the canvas and the settings sidebar, whoever wrote it.
