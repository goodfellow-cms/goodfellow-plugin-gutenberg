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
import { cleanRichText } from "./rich-text.js";

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

interface FieldShape {
  type?: string;
  arrayFields?: Record<string, FieldShape>;
  objectFields?: Record<string, FieldShape>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A value pasted for a field, as the field takes it: rich text cleaned as
 * typed rich text is, words as words, lists and objects field by field, and
 * `undefined` for anything else, which is left out. Slots are blocks of their
 * own, never props.
 */
function pastedValue(field: FieldShape | undefined, value: unknown, doc: Document): unknown {
  switch (field?.type) {
    case undefined:
    case "slot":
      return undefined;
    case "richtext":
      return typeof value === "string" ? cleanRichText(value, doc) : undefined;
    case "text":
    case "textarea":
      return typeof value === "string" ? value : undefined;
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? value : undefined;
    case "select":
    case "radio":
      return ["string", "number", "boolean"].includes(typeof value) || value === null ? value : undefined;
    case "array":
      return Array.isArray(value)
        ? value.filter(isPlainObject).map((item) => pastedFields(field.arrayFields ?? {}, item, doc))
        : undefined;
    case "object":
      return isPlainObject(value) ? pastedFields(field.objectFields ?? {}, value, doc) : undefined;
    default:
      // The site's own fields, such as media and tables, which the editor checks against the block's fields when
      // it's published (`checkEditedData()`).
      return value;
  }
}

/** Pasted values for the fields there are, each as its field takes it. */
function pastedFields(fields: Record<string, FieldShape>, values: Record<string, unknown>, doc: Document) {
  return Object.fromEntries(
    Object.entries(values).flatMap(([name, value]) => {
      const kept = pastedValue(fields[name], value, doc);
      return kept === undefined ? [] : [[name, kept]];
    }),
  );
}

/**
 * Gutenberg's blocks that are the site's, with the same in their slots, and
 * their props as the site's fields take them: block markup on the clipboard
 * can come from anywhere, such as a web page, so nothing in it is taken as
 * it is, as nothing pasted as HTML is.
 */
function siteBlocks(blocks: BlockInstance[], description: Description, names: BlockNames, doc: Document): BlockInstance[] {
  return blocks
    .filter((block) => block.name === SLOT_BLOCK || names.fromGutenberg(block.name))
    .map((block) => {
      const innerBlocks = siteBlocks(block.innerBlocks, description, names, doc);
      if (block.name === SLOT_BLOCK) return { ...block, innerBlocks };
      const fields = (description.blocks[names.fromGutenberg(block.name) as string]?.fields ?? {}) as Record<
        string,
        FieldShape
      >;
      const given = (block.attributes as { props?: unknown }).props;
      const props = isPlainObject(given) ? given : {};
      const kept = pastedFields(fields, props, doc);
      return {
        ...block,
        attributes: { ...block.attributes, props: typeof props.id === "string" ? { id: props.id, ...kept } : kept },
        innerBlocks,
      };
    });
}

/** What's pasted, as Gutenberg's blocks of the site's own. */
export function pastedBlocks(
  pasted: { html: string; text: string },
  description: Description,
  names: BlockNames,
  doc: Document = document,
): BlockInstance[] {
  // Blocks copied in Gutenberg, the site's own with their props as the site's fields take them: ids of their own
  // come when they're added.
  if (pasted.html.includes("<!-- wp:")) {
    const copied = siteBlocks(parse(pasted.html), description, names, doc).filter((block) => block.name !== SLOT_BLOCK);
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
