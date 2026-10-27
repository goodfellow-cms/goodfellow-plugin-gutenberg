/**
 * Gutenberg's "+" between two blocks. Gutenberg offers it only while the
 * pointer is over a block list's own box, in the gap between two of its
 * blocks, but the site's blocks are drawn as the site draws them: flush
 * against each other, in slots that take no box of their own (`display:
 * contents`). So the plugin finds the gap itself: near the edge two blocks in
 * the same list share, it shows Gutenberg's insertion point there, with its
 * "+", as Gutenberg would.
 */
import { store as blockEditorStore } from "@wordpress/block-editor";
import { type RefObject, useEffect } from "react";
import type { EditorRegistry } from "./paste.js";

/** How near an edge between two blocks, in pixels, the pointer brings up the "+". */
export const EDGE = 12;

interface Selectors {
  getBlockRootClientId(clientId: string): string | null;
  getBlockOrder(rootClientId?: string | null): string[];
  getTemplateLock(rootClientId?: string | null): string | false | undefined;
  getBlockListSettings(rootClientId?: string | null): { orientation?: "vertical" | "horizontal" } | undefined;
  isMultiSelecting(): boolean;
  isBlockInsertionPointVisible(): boolean;
  getBlockInsertionPoint(): { rootClientId?: string | null; index?: number };
}

interface Actions {
  showInsertionPoint(rootClientId: string | null | undefined, index: number, meta: Record<string, unknown>): void;
  hideInsertionPoint(): void;
}

/** Where a block may go at the pointer, between two blocks of the same list, or `null`. */
export function gapAt(
  target: Element,
  point: { x: number; y: number },
  select: Pick<Selectors, "getBlockRootClientId" | "getBlockOrder" | "getTemplateLock" | "getBlockListSettings">,
): { rootClientId: string | null; index: number } | null {
  for (let block = target.closest("[data-block]"); block; block = block.parentElement?.closest("[data-block]") ?? null) {
    const clientId = block.getAttribute("data-block") as string;
    const rootClientId = select.getBlockRootClientId(clientId);
    // A block's slots are fixed (`templateLock: "all"`); only the blocks in them, and the page's, move.
    if (select.getTemplateLock(rootClientId)) continue;
    const order = select.getBlockOrder(rootClientId);
    const index = order.indexOf(clientId);
    if (index === -1) continue;
    const rect = block.getBoundingClientRect();
    const across = select.getBlockListSettings(rootClientId)?.orientation === "horizontal";
    const [position, start, end, from, to, along] = across
      ? [point.x, rect.left, rect.right, rect.top, rect.bottom, point.y]
      : [point.y, rect.top, rect.bottom, rect.left, rect.right, point.x];
    if (along < from || along > to) continue;
    // Only between two blocks: before the first and after the last are the block list's own.
    if (position - start <= EDGE && index > 0) return { rootClientId, index };
    if (end - position <= EDGE && index < order.length - 1) return { rootClientId, index: index + 1 };
  }
  return null;
}

/** Shows Gutenberg's insertion point, with its "+", in the gap between two blocks the pointer is near. */
export function useInBetweenInserter(content: RefObject<HTMLElement | null>, registry: EditorRegistry): void {
  useEffect(() => {
    const element = content.current;
    if (!element) return;
    const select = () => registry.select(blockEditorStore) as unknown as Selectors;
    const dispatch = () => registry.dispatch(blockEditorStore) as unknown as Actions;
    let shown: string | null = null;
    const move = (event: MouseEvent) => {
      const doc = element.ownerDocument;
      // While Gutenberg's inserter is open, the insertion point is where it adds blocks: it stays.
      if (doc.querySelector(".block-editor-inserter__popover, .block-editor-inserter__quick-inserter")) return;
      const selectors = select();
      if (selectors.isMultiSelecting() || !(event.target instanceof Element)) return;
      const gap = gapAt(event.target, { x: event.clientX, y: event.clientY }, selectors);
      if (!gap) {
        // Gutenberg's own, over a block list's box, are left alone.
        if (shown) dispatch().hideInsertionPoint();
        shown = null;
        return;
      }
      const key = `${gap.rootClientId ?? ""}:${gap.index}`;
      const point = selectors.getBlockInsertionPoint();
      if (
        key === shown &&
        selectors.isBlockInsertionPointVisible() &&
        (point.rootClientId ?? null) === gap.rootClientId &&
        point.index === gap.index
      ) {
        return;
      }
      shown = key;
      dispatch().showInsertionPoint(gap.rootClientId ?? undefined, gap.index, { __unstableWithInserter: true });
    };
    // Leaving the canvas, other than for the "+" itself, which Gutenberg draws outside it.
    const leave = (event: MouseEvent) => {
      const to = event.relatedTarget instanceof Element ? event.relatedTarget : null;
      if (!shown || to?.closest(".block-editor-block-list__insertion-point, .components-popover")) return;
      shown = null;
      dispatch().hideInsertionPoint();
    };
    // After Gutenberg's own, which hides the insertion point wherever the pointer isn't over a block list's box.
    element.addEventListener("mousemove", move);
    element.addEventListener("mouseleave", leave);
    return () => {
      element.removeEventListener("mousemove", move);
      element.removeEventListener("mouseleave", leave);
    };
  }, [content, registry]);
}
