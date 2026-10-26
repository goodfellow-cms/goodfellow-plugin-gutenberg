/**
 * Registers the site's blocks with Gutenberg, from its description alone: the
 * plugin never has the blocks' code, only their fields. How each is drawn in
 * the editor is up to `edit` and `slotEdit`; nothing is saved as HTML.
 */
import type { SiteDescription } from "@goodfellow-cms/core";
import { type BlockConfiguration, getBlockType, registerBlockType, unregisterBlockType } from "@wordpress/blocks";
import type { ComponentType } from "react";
import { type BlockNames, blockNames, SLOT_BLOCK } from "./names.js";

/** What Gutenberg gives a block's `edit` component, as far as the plugin uses it. */
export interface EditProps {
  name: string;
  attributes: unknown;
  setAttributes: (attributes: Record<string, unknown>) => void;
  clientId: string;
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
      attributes: { props: { type: "object", default: {} } },
      // Every block's look is the site's own, so Gutenberg's own options for it stay off for now.
      supports: { html: false, reusable: false, customClassName: false, className: false },
      edit: options.edit,
      save: () => null,
    } as unknown as BlockConfiguration);
  }
  registerBlockType(SLOT_BLOCK, {
    apiVersion: 3,
    title: "Slot",
    category: "design",
    parent: all,
    attributes: { slot: { type: "string", default: "" } },
    supports: { html: false, reusable: false, inserter: false, customClassName: false, className: false, lock: false },
    edit: options.slotEdit,
    save: () => null,
  } as unknown as BlockConfiguration);
  return names;
}
