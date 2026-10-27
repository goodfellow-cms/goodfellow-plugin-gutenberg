/**
 * Gutenberg's transforms between the site's blocks, as WordPress turns a
 * paragraph into a heading: between blocks whose words are one field edited
 * in place, with no slots, the words go across, as plain text where the new
 * block's field is plain, and its CSS classes with them. Each new block starts
 * from the site's defaults for it; `withBlockIds()` gives it an id.
 */
import type { SiteDescription } from "@goodfellow-cms/core";
import { createBlock } from "@wordpress/blocks";
import { type GoodfellowAttributes, withStyleClasses } from "./convert.js";
import { type InPlaceField, inPlaceFields, plainText } from "./in-place.js";
import { type BlockNames, slotNames } from "./names.js";
import { hasClassName } from "./register.js";
import { stylesFromClasses } from "./styles.js";

type Description = Pick<SiteDescription, "blocks">;

/** The field a block's words are in, where they're in one: rich text before plain, as Text has. */
export function wordsField(block: Description["blocks"][string] | undefined): InPlaceField | undefined {
  if (!block || slotNames(block).length > 0) return undefined;
  const fields = inPlaceFields(block.fields);
  return fields.find((field) => field.type === "richtext") ?? fields[0];
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A field's value as another field holds it: rich text keeps its formatting only into rich text. */
export function wordsFor(from: InPlaceField, to: InPlaceField, value: unknown, doc: Document): string {
  const text = typeof value === "string" ? value : "";
  if (from.type === "richtext") return to.type === "richtext" ? text : plainText(from, text, doc).trim();
  if (to.type !== "richtext") return to.type === "text" ? text.replace(/\s*\n\s*/g, " ") : text;
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** What Gutenberg's `transforms` takes: a transform to each other block the words can go to. */
interface BlockTransform {
  type: "block";
  blocks: string[];
  transform: (attributes: Partial<GoodfellowAttributes>) => unknown;
}

/** The transforms from one of the site's blocks to the others whose words are one field too, in `types`. */
export function transformsFrom(
  type: string,
  description: Description,
  names: BlockNames,
  types: readonly string[],
): BlockTransform[] {
  const from = wordsField(description.blocks[type]);
  if (!from) return [];
  return types.flatMap((target): BlockTransform[] => {
    const block = description.blocks[target];
    const to = wordsField(block);
    const name = names.toGutenberg(target);
    if (target === type || !to || !name) return [];
    return [
      {
        type: "block",
        blocks: [name],
        transform: (attributes) => {
          const props = attributes.props ?? {};
          // Its classes as they'd be published, with what's chosen in the Styles tab, then as the new block's styling
          // options and additional classes again, as a block opened in Gutenberg has them.
          const styled = hasClassName(description.blocks[type])
            ? withStyleClasses(props, attributes as Record<string, unknown>).className
            : undefined;
          const className = hasClassName(block) && typeof styled === "string" ? styled : "";
          const styles = className ? stylesFromClasses(className) : undefined;
          return createBlock(name, {
            props: {
              ...(block?.defaultProps ?? {}),
              [to.name]: wordsFor(from, to, props[from.name], document),
              ...(className && { className }),
            },
            ...styles?.attributes,
            ...(styles?.rest.length && { className: styles.rest.join(" ") }),
          });
        },
      },
    ];
  });
}
