---
"goodfellow-plugin-gutenberg": minor
---

Gutenberg's Hide option, in a block's Options menu, hides it on phones, tablets or computers, kept as the classes Goodfellow's Style setting writes for its Hide on (`max-sm:hidden`, `sm:max-lg:hidden`, `lg:hidden`), with Tailwind's breakpoints as Gutenberg's sizes of screen. Blocks hidden that way in Puck show as hidden in Gutenberg, and the other way round.

Forms in the editor, such as the Hide and Rename dialogs and the link form, now work: the frame's sandbox submits no forms, so the plugin sends their submit itself when their button is clicked or Enter is pressed.
