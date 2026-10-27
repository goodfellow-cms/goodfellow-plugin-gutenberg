/**
 * Goodfellow's page data as Gutenberg's blocks, and back, losing nothing: a
 * block's props are its `props` attribute, exactly as they are, and each slot
 * a `goodfellow/slot` block holding the slot's blocks. Nothing is ever written
 * as Gutenberg's HTML.
 */
import type { SiteDescription } from "@goodfellow-cms/core";
import type { ComponentData } from "@puckeditor/core";
import { type Block as BlockInstance, cloneBlock, createBlock } from "@wordpress/blocks";
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

/**
 * Gutenberg's blocks as Goodfellow's content again, every slot filled in, if
 * only with nothing. Blocks that aren't the site's, such as the one Gutenberg
 * puts in place of a block it doesn't know, are left out.
 */
export function fromGutenberg(blocks: BlockInstance[], description: Description, names: BlockNames): ComponentData[] {
  return blocks.flatMap((block) => {
    const type = names.fromGutenberg(block.name);
    if (!type) return [];
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
    return [{ type, props } as ComponentData];
  });
}

/** A new id for a block of a type, as Puck gives them: the type, then something no other block has. */
export function newBlockId(type: string): string {
  const unique =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${type}-${unique}`;
}

/**
 * Gives each of the site's blocks an id of its own, as content needs: blocks
 * just added in Gutenberg have none, and ones it duplicated have their
 * original's. Blocks that already have one of their own are left as they are,
 * so it's the same list when nothing needed one.
 */
export function withBlockIds(blocks: BlockInstance[], names: BlockNames, seen = new Set<string>()): BlockInstance[] {
  let changed = false;
  const result = blocks.map((block) => {
    const innerBlocks = withBlockIds(block.innerBlocks, names, seen);
    const type = names.fromGutenberg(block.name);
    const props = (block.attributes as Partial<GoodfellowAttributes>).props;
    const id = props?.id;
    const needsId = type !== undefined && (typeof id !== "string" || id === "" || seen.has(id));
    const ownId = needsId ? newBlockId(type) : (id as string | undefined);
    if (type !== undefined && ownId) seen.add(ownId);
    if (!needsId && innerBlocks === block.innerBlocks) return block;
    changed = true;
    const attributes = needsId ? { ...block.attributes, props: { ...props, id: ownId } } : block.attributes;
    return { ...cloneBlock(block, attributes, innerBlocks), clientId: block.clientId };
  });
  return changed ? result : blocks;
}
