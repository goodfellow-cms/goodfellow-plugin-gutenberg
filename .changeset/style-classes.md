---
"goodfellow-plugin-gutenberg": patch
---

Changing a block's styling in Gutenberg no longer drops or changes spacing and corner classes written by hand: a class is read as a styling option only where it would be written back as the same class, and classes for some sides or one corner (`mx-2`, `rounded-tl-sm`) are read over one for all of them (`m-4`, `rounded-lg`), as Tailwind applies them, whatever order they're written in.
