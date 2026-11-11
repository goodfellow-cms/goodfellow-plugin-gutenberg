---
"goodfellow-plugin-gutenberg": patch
---

Text edited in place no longer goes into a drawn block's event handlers, styles, or frames' `srcdoc`, and goes into an address (`href`, `src`, and the like) only where the address it makes is one a page may have, since the block checked its addresses while a marker stood in for the text. Releases are built and tested in a job of their own, and staged from a second job that runs none of the repository's code, so no package the build installs runs where npm's publishing token can be had.
