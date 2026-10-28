---
"goodfellow-plugin-gutenberg": patch
---

Leaves showing the site's media to Goodfellow where it does it itself in editor plugins' frames (`session.showsMedia`), which also shows pictures uploaded but not yet published, and media a storage plugin such as S3 keeps. On earlier Goodfellow releases the plugin still adds the site's folder to media addresses itself.
