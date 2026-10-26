/**
 * Goodfellow's blocks as Gutenberg's: every block of the site becomes a
 * Gutenberg block of its own, named `goodfellow/<name>` (Gutenberg's names are
 * lowercase letters, digits and dashes), and each of a block's slots is a
 * `goodfellow/slot` block inside it, so a block with several slots keeps them
 * apart and each can be drawn where it belongs in the block's own layout.
 */
import type { SiteDescription } from "@goodfellow-cms/core";

export const NAMESPACE = "goodfellow";

/** The block that holds one of a block's slots, its `slot` attribute naming which. */
export const SLOT_BLOCK = `${NAMESPACE}/slot`;

/** Gutenberg's name for each of the site's blocks, and the other way round. */
export interface BlockNames {
  toGutenberg(type: string): string | undefined;
  fromGutenberg(name: string): string | undefined;
  /** The site's blocks, by the name content refers to them by, in the description's order. */
  types: string[];
}

function kebab(type: string): string {
  const name = type
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return /^[a-z]/.test(name) ? name : `block-${name}`;
}

/**
 * Gutenberg's names for the site's blocks. Names that would come out the same,
 * such as `PageList` and `page-list`, are told apart by a number, in the
 * description's order, so the same site always gets the same names.
 */
export function blockNames(description: Pick<SiteDescription, "blocks">): BlockNames {
  const types = Object.keys(description.blocks);
  const forward = new Map<string, string>();
  const backward = new Map<string, string>();
  for (const type of types) {
    const base = `${NAMESPACE}/${kebab(type)}`;
    let name = base;
    for (let n = 2; backward.has(name) || name === SLOT_BLOCK; n += 1) name = `${base}-${n}`;
    forward.set(type, name);
    backward.set(name, type);
  }
  return {
    toGutenberg: (type) => forward.get(type),
    fromGutenberg: (name) => backward.get(name),
    types,
  };
}

/** A block's slots, in the order its fields declare them. */
export function slotNames(block: { fields: Record<string, unknown> } | undefined): string[] {
  return Object.entries(block?.fields ?? {})
    .filter(([, field]) => (field as { type?: unknown })?.type === "slot")
    .map(([name]) => name);
}
