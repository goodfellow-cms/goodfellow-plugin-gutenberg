/**
 * Goodfellow's page data as Gutenberg's blocks, and back, losing nothing: a
 * block's props are its `props` attribute, exactly as they are, and each slot
 * a `goodfellow/slot` block holding the slot's blocks. Nothing is ever written
 * as Gutenberg's HTML.
 */
import type { SiteDescription } from "@goodfellow-cms/core";
import type { ComponentData } from "@puckeditor/core";
import { type Block as BlockInstance, createBlock } from "@wordpress/blocks";
import { type BlockNames, SLOT_BLOCK, slotNames } from "./names.js";

/** A block's attributes: its props without its slots, which are blocks of their own. */
export interface GoodfellowAttributes {
  props: Record<string, unknown>;
}

/** A slot's attributes: which of its block's slots it is. */
export interface SlotAttributes {
  slot: string;
}

type Description = Pick<SiteDescription, "blocks">;

/** The blocks in Goodfellow's content as Gutenberg's, which must have been registered (`registerBlocks()`). */
export function toGutenberg(content: ComponentData[], description: Description, names: BlockNames): BlockInstance[] {
  return content.map((block) => {
    const name = names.toGutenberg(block.type);
    if (!name) throw new Error(`The site has no block called ${block.type}.`);
    const slots = slotNames(description.blocks[block.type]);
    const props = Object.fromEntries(Object.entries(block.props).filter(([key]) => !slots.includes(key)));
    const inner = slots.map((slot) => {
      const children = block.props[slot];
      return createBlock(
        SLOT_BLOCK,
        { slot } satisfies SlotAttributes,
        toGutenberg(Array.isArray(children) ? (children as ComponentData[]) : [], description, names),
      );
    });
    return createBlock(name, { props } satisfies GoodfellowAttributes, inner);
  });
}

/** Gutenberg's blocks as Goodfellow's content again, every slot filled in, if only with nothing. */
export function fromGutenberg(blocks: BlockInstance[], description: Description, names: BlockNames): ComponentData[] {
  return blocks.map((block) => {
    const type = names.fromGutenberg(block.name);
    if (!type) throw new Error(`${block.name} isn't one of the site's blocks.`);
    const attributes = block.attributes as Partial<GoodfellowAttributes>;
    const props: Record<string, unknown> = { ...(attributes.props ?? {}) };
    const inner = new Map(
      block.innerBlocks
        .filter((child) => child.name === SLOT_BLOCK)
        .map((child) => [(child.attributes as Partial<SlotAttributes>).slot, child.innerBlocks]),
    );
    for (const slot of slotNames(description.blocks[type])) {
      props[slot] = fromGutenberg(inner.get(slot) ?? [], description, names);
    }
    return { type, props } as ComponentData;
  });
}
