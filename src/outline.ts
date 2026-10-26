/**
 * Drawing blocks from their fields alone, with no renderer: each block as a
 * box with its name and the words in its text fields, and its slots one under
 * another. It needs nothing but the site's description, so it works where
 * nothing can draw the site's blocks, but it doesn't look like the site.
 */
import type { SiteDescription } from "@goodfellow-cms/core";
import type { ComponentData } from "@puckeditor/core";
import { type BlockRenderer, SLOT_PLACEHOLDER } from "./edit.js";
import type { Field } from "./fields.js";
import { slotNames } from "./names.js";

/** The field types whose words are shown. */
const WORD_TYPES = new Set(["text", "textarea"]);

function escape(text: string): string {
  return text.replace(/[&<>"]/g, (character) => `&#${character.charCodeAt(0)};`);
}

/** The block's slot placeholders' names, as the editor left them in its props. */
function placeholder(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  const [block] = value as ComponentData[];
  return block?.type === SLOT_PLACEHOLDER ? String(block.props.slot) : undefined;
}

/** A `BlockRenderer` that draws each block from its fields. */
export function outlineRenderer(description: Pick<SiteDescription, "blocks">): BlockRenderer {
  return {
    async render({ type, props }) {
      const block = description.blocks[type];
      const fields = block?.fields ?? {};
      const words = (Object.entries(fields) as [string, Field][])
        .filter(([name, field]) => WORD_TYPES.has(field.type) && name !== "className" && props[name])
        .map(([name]) => `<p class="gf-outline-words">${escape(String(props[name]))}</p>`);
      const slots = slotNames(block)
        .map((slot) => placeholder(props[slot]))
        .filter((slot) => slot !== undefined)
        .map((slot) => `<div class="gf-outline-slot"><gf-slot data-slot="${escape(slot)}"></gf-slot></div>`);
      return `<div class="gf-outline"><p class="gf-outline-name">${escape(block?.label ?? type)}</p>${words.join("")}${slots.join("")}</div>`;
    },
  };
}
