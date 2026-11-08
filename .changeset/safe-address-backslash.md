---
"goodfellow-plugin-gutenberg": patch
---

Links are checked, and stored, as browsers read them: trimmed, without tabs and line breaks. Those that then start with `//` or `/\`, such as `/\example.org`, are no longer taken for addresses on the site, since browsers read them as another site's.
