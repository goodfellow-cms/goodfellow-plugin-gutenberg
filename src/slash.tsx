/**
 * Typing "/" to choose a block, as in Gutenberg's paragraphs: in text edited
 * on the canvas, a line that's only "/" and what's typed after it lists the
 * blocks that may go there. Choosing one takes the line out and puts the
 * block in place of the one being typed in, where that's left with no text,
 * or after it.
 */
import { BlockIcon, store as blockEditorStore } from "@wordpress/block-editor";
import { type Block as BlockInstance, createBlock } from "@wordpress/blocks";
import { Popover } from "@wordpress/components";
import { useRegistry } from "@wordpress/data";
import { type RefObject, useEffect, useRef, useState } from "react";
import type { EditorRegistry } from "./paste.js";

/** How many blocks the list shows at once, as Gutenberg's does. */
const SHOWN = 9;

/** A line that asks for a block: "/" and, after it, words to find it by. */
const ASKING = /^\/([\p{L}\p{N} -]{0,40})$/u;

/** What Gutenberg's inserter offers, as far as the list uses it. */
export interface InserterItem {
  name: string;
  title: string;
  icon?: unknown;
  keywords?: string[];
  isDisabled?: boolean;
  initialAttributes?: Record<string, unknown>;
}

/** The blocks words find, best first: by the start of their name, then anywhere in it or their keywords. */
export function slashMatches(items: readonly InserterItem[], words: string): InserterItem[] {
  const query = words.trim().toLowerCase();
  const usable = items.filter((item) => !item.isDisabled);
  if (!query) return usable.slice(0, SHOWN);
  const rank = (item: InserterItem) => {
    const title = item.title.toLowerCase();
    if (title.startsWith(query)) return 0;
    if (title.split(/\s+/).some((word) => word.startsWith(query))) return 1;
    if (title.includes(query)) return 2;
    if ((item.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(query))) return 3;
    return -1;
  };
  return usable
    .map((item) => ({ item, rank: rank(item) }))
    .filter(({ rank }) => rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, SHOWN)
    .map(({ item }) => item);
}

/** The line the caret is on in text edited in place: its paragraph, heading or list item, or the field itself. */
export function caretLine(field: HTMLElement): HTMLElement | null {
  const selection = field.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;
  const node = selection.anchorNode;
  if (!node || !field.contains(node)) return null;
  let element = node.nodeType === 1 ? (node as HTMLElement) : node.parentElement;
  while (element && element !== field && !/^(P|H[1-6]|LI|DIV|BLOCKQUOTE|PRE)$/.test(element.tagName)) {
    element = element.parentElement;
  }
  return element;
}

interface Asking {
  field: HTMLElement;
  line: HTMLElement;
  clientId: string;
  rootClientId: string | null;
  words: string;
}

interface Store {
  getBlockRootClientId(clientId: string): string | null;
  getInserterItems(rootClientId?: string | null): InserterItem[];
}

interface Changes {
  replaceBlocks(clientIds: string, blocks: BlockInstance[]): void;
  insertBlocks(blocks: BlockInstance[], index: number, rootClientId?: string | null): void;
}

/** Lists the blocks a "/" line asks for, under it, and puts the one chosen on the page. */
export function SlashInserter({ content, registry }: { content: RefObject<HTMLElement | null>; registry: EditorRegistry }) {
  const [asking, setAsking] = useState<Asking | null>(null);
  const [active, setActive] = useState(0);
  const latest = useRef({ asking, active, found: [] as InserterItem[] });
  const select = () => registry.select(blockEditorStore) as unknown as Store;
  const found = asking ? slashMatches(select().getInserterItems(asking.rootClientId), asking.words) : [];
  latest.current = { asking, active, found };

  const choose = (item: InserterItem) => {
    const now = latest.current.asking;
    if (!now) return;
    setAsking(null);
    const { field, line, clientId } = now;
    // The line goes, as the field keeps it: the field hears of it as it does of typing.
    if (line === field) field.textContent = "";
    else line.remove();
    field.dispatchEvent(new Event("input", { bubbles: true }));
    const block = createBlock(item.name, item.initialAttributes);
    const changes = registry.dispatch(blockEditorStore) as unknown as Changes;
    const store = registry.select(blockEditorStore) as unknown as {
      getBlockIndex(clientId: string): number;
    };
    // Any words left in the block, rather than in the blocks in its slots, keep it.
    const wrapper = field.closest("[data-block]");
    const words = [...(wrapper?.querySelectorAll<HTMLElement>(".gf-in-place") ?? [])]
      .filter((element) => element.closest("[data-block]") === wrapper)
      .some((element) => (element.textContent ?? "").trim() !== "");
    if (words) changes.insertBlocks([block], store.getBlockIndex(clientId) + 1, now.rootClientId);
    else changes.replaceBlocks(clientId, [block]);
  };

  useEffect(() => {
    const element = content.current;
    if (!element) return;
    const look = (event: Event) => {
      const field = (event.target as Element | null)?.closest?.<HTMLElement>(".gf-in-place");
      const line = field && caretLine(field);
      const match = line && ASKING.exec(line.textContent ?? "");
      const clientId = field?.closest("[data-block]")?.getAttribute("data-block");
      if (!field || !line || !match || !clientId) {
        if (latest.current.asking) setAsking(null);
        return;
      }
      const rootClientId = select().getBlockRootClientId(clientId);
      setAsking({ field, line, clientId, rootClientId, words: match[1] ?? "" });
      if (latest.current.asking?.words !== (match[1] ?? "")) setActive(0);
    };
    const keys = (event: KeyboardEvent) => {
      const { asking: now, active: current, found: list } = latest.current;
      if (!now || list.length === 0) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((current + step + list.length) % list.length);
      } else if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        const item = list[current];
        if (item) choose(item);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setAsking(null);
      }
    };
    const leave = () => setAsking(null);
    element.addEventListener("input", look);
    element.addEventListener("keydown", keys, true);
    element.addEventListener("focusout", leave);
    return () => {
      element.removeEventListener("input", look);
      element.removeEventListener("keydown", keys, true);
      element.removeEventListener("focusout", leave);
    };
  });

  if (!asking) return null;
  return (
    <Popover anchor={asking.line} placement="bottom-start" focusOnMount={false} className="gf-slash" onClose={() => setAsking(null)}>
      {found.length === 0 ? (
        <p className="gf-slash-none">No blocks match.</p>
      ) : (
        <div role="listbox" aria-label="Blocks" className="gf-slash-list">
          {found.map((item, index) => (
            <div
              key={item.name}
              role="option"
              tabIndex={-1}
              aria-selected={index === active}
              className={`gf-slash-item${index === active ? " is-active" : ""}`}
              // Keeps the caret in the text, as the list is chosen from while typing.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
              onMouseEnter={() => setActive(index)}
            >
              <BlockIcon icon={item.icon} showColors />
              <span>{item.title}</span>
            </div>
          ))}
        </div>
      )}
    </Popover>
  );
}
