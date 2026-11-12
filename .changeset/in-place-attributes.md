---
"goodfellow-plugin-gutenberg": patch
---

Text edited in place no longer goes into a drawn block's event handlers, styles, or frames' `srcdoc`, and goes into an address (`href`, `src`, and the like) only where the address it makes is one a page may have (in a `srcset`, each candidate's, keeping the others), since the block checked its addresses while a marker stood in for the text. A site address ending in a long run of slashes no longer slows down showing its media in the frame. Releases are built and tested in a job of their own, and staged from a second job that runs none of the repository's code, so no package the build installs runs where npm's publishing token can be had.
