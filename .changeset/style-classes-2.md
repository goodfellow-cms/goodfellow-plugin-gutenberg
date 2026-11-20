---
"goodfellow-plugin-gutenberg": patch
---

Gutenberg's styling options keep three more kinds of hand-written spacing and corner classes as written, with every other class for the same property: logical top and bottom spacing (`pbs-2`, `mbe-2`, and their negative margins), a radius for every corner with more than one value (`rounded-[1rem_2rem]`, which copied into one corner would draw an ellipse), and a value with a custom property whose name has an underscore (`p-[var(--space__wide)]`), which was read as a space.
