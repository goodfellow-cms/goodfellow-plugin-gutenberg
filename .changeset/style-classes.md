---
"goodfellow-plugin-gutenberg": patch
---

Changing a block's styling in Gutenberg no longer drops spacing and corner classes written by hand, or changes what they do. A class is read as a styling option only where the plugin would write it back, as it is or as a class that does the same (`p-[1rem]` as `p-4`). Where one isn't, such as a long `px-[…]` or one with a quote, it and every other class for the same property (padding, margin, or corners) stay as written, so Gutenberg never shows a value they win over. Classes for some sides or one corner (`mx-2`, `rounded-tl-sm`) are read over one for all of them (`m-4`, `rounded-lg`), as Tailwind applies them, whatever order they're written in.
