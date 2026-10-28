---
"goodfellow-plugin-gutenberg": patch
---

Images show on sites in a folder of their domain, such as GitHub Pages' `example.github.io/site/`: on the canvas, in the sidebar's media fields and in the link preview. Before, they were looked for at the root of the domain. Goodfellow releases that show the site's media in editor plugins' frames themselves (`session.showsMedia`), uploads not yet published and a storage plugin's files included, are left to do it.
