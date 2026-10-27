/**
 * Registers the site's blocks with Gutenberg, from its description alone: the
 * plugin never has the blocks' code, only their fields. How each is drawn in
 * the editor is up to `edit` and `slotEdit`; nothing is saved as HTML.
 */
import type { SiteDescription } from "@goodfellow-cms/core";
import { InnerBlocks } from "@wordpress/block-editor";
import { type BlockConfiguration, getBlockType, registerBlockType, unregisterBlockType } from "@wordpress/blocks";
import { type ComponentType, createElement } from "react";
import { blockIcon } from "./icons.js";
import { type BlockNames, blockNames, onlySlot, SLOT_BLOCK, slotNames } from "./names.js";
import { STYLE_SUPPORTS } from "./styles.js";

function withoutSlots(props: Record<string, unknown>, slots: string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(props).filter(([key]) => !slots.includes(key)));
}

/** What Gutenberg gives a block's `edit` component, as far as the plugin uses it. */
export interface EditProps {
  name: string;
  attributes: unknown;
  setAttributes: (attributes: Record<string, unknown>) => void;
  clientId: string;
  isSelected?: boolean;
}

/** What an editor gets: the block being edited, as Gutenberg's `edit` components do. */
export type EditComponent = ComponentType<EditProps>;

export interface RegisterOptions {
  /** Draws one of the site's blocks in the editor. */
  edit: EditComponent;
  /** Draws a slot, and the blocks in it. */
  slotEdit: EditComponent;
  /** Leave out template-only blocks, as everywhere but collections' templates. */
  templates?: boolean;
}

/**
 * What a block saves, which Gutenberg only uses to copy blocks: their slots'
 * blocks, so a copy has them too. Content is never kept as Gutenberg's HTML.
 */
const saveInnerBlocks = () => createElement(InnerBlocks.Content);

/**
 * The block Gutenberg puts in place of one it doesn't know, such as one of
 * WordPress's own from a paste: Gutenberg would otherwise look for it for
 * ever. It shows nothing and is never saved.
 */
const MISSING_BLOCK = "core/missing";

/** Whether a block keeps CSS classes, as every block does (`classNameField`). */
export function hasClassName(block: { fields: Record<string, unknown> } | undefined): boolean {
  return (block?.fields.className as { type?: string } | undefined)?.type === "text";
}

/** Registers the site's blocks and the slot block, replacing any registered before. Returns their names. */
export function registerBlocks(description: Pick<SiteDescription, "blocks">, options: RegisterOptions): BlockNames {
  const names = blockNames(description);
  const blocks = names.types.filter((type) => options.templates || !description.blocks[type]?.templateOnly);
  const all = blocks.map((type) => names.toGutenberg(type) as string);
  for (const name of [...all, SLOT_BLOCK]) if (getBlockType(name)) unregisterBlockType(name);
  for (const type of blocks) {
    const block = description.blocks[type];
    registerBlockType(names.toGutenberg(type) as string, {
      apiVersion: 3,
      title: block?.label ?? type,
      category: "design",
      icon: blockIcon((block as { icon?: unknown } | undefined)?.icon),
      // A block just added starts with the site's defaults for it, without its slots: a block with several has a
      // slot block for each, which then stay as they are (`templateLock: "all"`), and one with only one holds that
      // slot's blocks itself.
      attributes: { props: { type: "object", default: withoutSlots(block?.defaultProps ?? {}, slotNames(block)) } },
      ...(!onlySlot(block) && { template: slotNames(block).map((slot) => [SLOT_BLOCK, { slot }]) }),
      // Gutenberg's styling options, kept as Tailwind classes in the block's `className` (`styles.ts`), for blocks
      // that have one, as every block does; other classes are its additional CSS classes.
      supports: {
        html: false,
        reusable: false,
        className: false,
        ...(hasClassName(block) ? { customClassName: true, ...STYLE_SUPPORTS } : { customClassName: false }),
      },
      edit: options.edit,
      save: saveInnerBlocks,
    } as unknown as BlockConfiguration);
  }
  // In the document overview, a slot is named as its field is, such as "Columns" or "Content".
  const slotLabels = new Map<string, string>();
  for (const type of blocks) {
    const fields = description.blocks[type]?.fields ?? {};
    for (const slot of slotNames(description.blocks[type])) {
      const label = (fields[slot] as { label?: unknown } | undefined)?.label;
      if (typeof label === "string" && !slotLabels.has(slot)) slotLabels.set(slot, label);
    }
  }
  registerBlockType(SLOT_BLOCK, {
    apiVersion: 3,
    title: "Slot",
    category: "design",
    parent: all.filter((name) => !onlySlot(description.blocks[names.fromGutenberg(name) as string])),
    __experimentalLabel: ({ slot = "" }: { slot?: string }) =>
      slotLabels.get(slot) ?? (slot ? slot.charAt(0).toUpperCase() + slot.slice(1) : "Slot"),
    attributes: { slot: { type: "string", default: "" } },
    supports: { html: false, reusable: false, inserter: false, customClassName: false, className: false, lock: false },
    edit: options.slotEdit,
    save: saveInnerBlocks,
  } as unknown as BlockConfiguration);
  if (!getBlockType(MISSING_BLOCK)) {
    registerBlockType(MISSING_BLOCK, {
      apiVersion: 3,
      title: "Missing block",
      category: "design",
      attributes: {
        originalName: { type: "string" },
        originalContent: { type: "string" },
        originalUndelimitedContent: { type: "string" },
      },
      supports: { html: false, reusable: false, inserter: false, customClassName: false, className: false },
      edit: () => null,
      save: () => null,
    } as unknown as BlockConfiguration);
  }
  return names;
}
