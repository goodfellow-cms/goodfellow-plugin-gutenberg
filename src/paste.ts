/**
 * HTML pasted onto the canvas, from another site, a document or WordPress
 * itself, as the site's blocks: Goodfellow's own conversion (`htmlBlocks()`,
 * the one its WordPress import uses) makes headings, text, pictures, lists,
 * quotes and the rest the site's blocks, and they're put after the selected
 * block. Text pasted into text being edited stays text.
 */
import type { SiteDescription } from "@goodfellow-cms/core";
import { htmlBlocks } from "@goodfellow-cms/core/wordpress";
import type { ComponentData } from "@puckeditor/core";
import { store as blockEditorStore } from "@wordpress/block-editor";
import { type Block as BlockInstance, parse } from "@wordpress/blocks";

import { toGutenberg } from "./convert.js";
import { escapeText } from "./fields.js";
import { type BlockNames, SLOT_BLOCK } from "./names.js";

type Description = Pick<SiteDescription, "blocks">;

/** Blocks the site has, with the same in their slots; any others are left out. */
function known(blocks: ComponentData[], description: Description, names: BlockNames): ComponentData[] {
  return blocks
    .filter((block) => description.blocks[block.type] && names.toGutenberg(block.type))
    .map((block) => ({
      ...block,
      props: Object.fromEntries(
        Object.entries(block.props).map(([key, value]) =>
          (description.blocks[block.type]?.fields[key] as { type?: string } | undefined)?.type === "slot" &&
          Array.isArray(value)
            ? [key, known(value as ComponentData[], description, names)]
            : [key, value],
        ),
      ),
    })) as ComponentData[];
}

/** Gutenberg's blocks that are the site's, with the same in their slots. */
function siteBlocks(blocks: BlockInstance[], names: BlockNames): BlockInstance[] {
  return blocks
    .filter((block) => block.name === SLOT_BLOCK || names.fromGutenberg(block.name))
    .map((block) => ({ ...block, innerBlocks: siteBlocks(block.innerBlocks, names) }));
}

/** What's pasted, as Gutenberg's blocks of the site's own. */
export function pastedBlocks(
  pasted: { html: string; text: string },
  description: Description,
  names: BlockNames,
): BlockInstance[] {
  // Blocks copied in Gutenberg, the site's own with their props as they were: ids of their own come when they're added.
  if (pasted.html.includes("<!-- wp:")) {
    const copied = siteBlocks(parse(pasted.html), names).filter((block) => block.name !== SLOT_BLOCK);
    if (copied.length > 0) return copied;
  }
  const html = pasted.html.trim() || escapeText(pasted.text);
  if (!html.trim()) return [];
  const { blocks } = htmlBlocks(html, { blocks: Object.keys(description.blocks) });
  return toGutenberg(known(blocks as ComponentData[], description, names), description, names);
}

interface Selection {
  getSelectedBlockClientId(): string | null;
  getBlockRootClientId(clientId: string): string | null;
  getBlockIndex(clientId: string): number;
  getBlockName(clientId: string): string | null;
  getBlockCount(rootClientId?: string): number;
}

interface Changes {
  insertBlocks(blocks: BlockInstance[], index?: number, rootClientId?: string): void;
}

/** The editor's own store, which `useRegistry()` gives: `BlockEditorProvider` keeps its blocks apart from Gutenberg's default one. */
export interface EditorRegistry {
  select(store: string): unknown;
  dispatch(store: string): unknown;
}

/** Puts blocks after the selected one, or into the selected slot, or at the end of the page. */
export function insertPasted(registry: EditorRegistry, blocks: BlockInstance[]): void {
  if (blocks.length === 0) return;
  const editor = registry.select(blockEditorStore) as Selection;
  const changes = registry.dispatch(blockEditorStore) as Changes;
  const selected = editor.getSelectedBlockClientId();
  if (!selected) {
    changes.insertBlocks(blocks, editor.getBlockCount());
    return;
  }
  if (editor.getBlockName(selected) === SLOT_BLOCK) {
    changes.insertBlocks(blocks, editor.getBlockCount(selected), selected);
    return;
  }
  const root = editor.getBlockRootClientId(selected) ?? undefined;
  changes.insertBlocks(blocks, editor.getBlockIndex(selected) + 1, root);
}

/** Whether a paste is into text being edited, which handles it itself. */
export function isIntoText(target: EventTarget | null): boolean {
  const element = target as Element | null;
  return Boolean(element?.closest?.("[data-gf-field], .gf-rich-text-field, input, textarea, select"));
}
