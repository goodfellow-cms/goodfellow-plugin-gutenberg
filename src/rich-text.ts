/**
 * Rich text as fields keep it: HTML with only what Puck's rich text editor
 * makes (paragraphs, headings, lists, quotes, code, bold, italic, underline,
 * strikethrough and links), whatever a browser's editing or a paste added.
 * The site shows rich text through Puck, which sanitizes it again.
 */

/** Elements kept as they are. */
const KEPT = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "strong",
  "em",
  "u",
  "s",
  "a",
  "br",
  "hr",
]);

/** Elements kept as the ones Puck uses for the same thing. */
const RENAMED: Record<string, string> = { b: "strong", i: "em", strike: "s", del: "s", div: "p" };

/** Elements left out with everything in them. */
const DROPPED = new Set(["script", "style", "template", "iframe", "object", "embed", "noscript", "head", "title", "meta", "link"]);

/** Elements whose contents belong in a paragraph when they're on their own, rather than beside it. */
const BLOCKS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "blockquote", "pre", "hr"]);

/** Whether a link's address is one a page may have: on the site, the web, email or phone. */
export function isSafeAddress(address: string): boolean {
  const trimmed = address.trim();
  if (/^(#|\/(?!\/)|\.{1,2}\/)/.test(trimmed)) return true;
  return /^(https?:|mailto:|tel:)/i.test(trimmed);
}

function cleanChildren(from: Node, into: Node, doc: Document) {
  for (const node of [...from.childNodes]) {
    if (node.nodeType === 3) {
      into.appendChild(doc.createTextNode((node as Text).data));
      continue;
    }
    if (node.nodeType !== 1) continue;
    const element = node as Element;
    const name = element.tagName.toLowerCase();
    if (DROPPED.has(name)) continue;
    const kept = RENAMED[name] ?? (KEPT.has(name) ? name : undefined);
    if (!kept) {
      cleanChildren(element, into, doc);
      continue;
    }
    // A paragraph inside a paragraph, as a browser makes when a line is split, is a paragraph of its own.
    const target = kept === "p" && into.nodeName === "P" && into.parentNode ? into.parentNode : into;
    const copy = doc.createElement(kept);
    if (kept === "a") {
      const href = element.getAttribute("href") ?? "";
      if (isSafeAddress(href)) copy.setAttribute("href", href.trim());
    }
    cleanChildren(element, copy, doc);
    target.appendChild(copy);
  }
}

/**
 * Lists, headings and the like a browser leaves inside a paragraph (`<p><ul>`,
 * as Chrome makes a list of a paragraph's line), put beside it instead, with
 * the paragraph's other words in paragraphs of their own around them.
 */
function liftBlocks(container: Element, doc: Document) {
  for (const paragraph of [...container.querySelectorAll("p")]) {
    const parent = paragraph.parentNode;
    if (!parent || ![...paragraph.children].some((child) => BLOCKS.has(child.tagName.toLowerCase()))) continue;
    let words: HTMLElement | null = null;
    for (const node of [...paragraph.childNodes]) {
      if (node.nodeType === 1 && BLOCKS.has(node.nodeName.toLowerCase())) {
        parent.insertBefore(node, paragraph);
        words = null;
        continue;
      }
      // Spaces between the paragraph's lists and headings aren't words of their own.
      if (!words && node.nodeType === 3 && (node as Text).data.trim() === "") continue;
      if (!words) words = parent.insertBefore(doc.createElement("p"), paragraph);
      words.appendChild(node);
    }
    paragraph.remove();
  }
}

export interface CleanOptions {
  /**
   * Keep empty paragraphs, as while text is being edited, where one is the
   * line just started. The value kept leaves them out.
   */
  keepEmpty?: boolean;
}

/** `html` with only what rich text keeps, and any words outside a paragraph put in one. */
export function cleanRichText(html: string, doc: Document, options: CleanOptions = {}): string {
  const template = doc.createElement("template");
  template.innerHTML = html;
  const cleaned = doc.createElement("div");
  cleanChildren(template.content, cleaned, doc);
  liftBlocks(cleaned, doc);

  // Words and inline formatting at the top go in paragraphs, as Puck's editor keeps them.
  const result = doc.createElement("div");
  let paragraph: HTMLElement | null = null;
  for (const node of [...cleaned.childNodes]) {
    const block = node.nodeType === 1 && BLOCKS.has(node.nodeName.toLowerCase());
    if (block) {
      paragraph = null;
      result.appendChild(node);
      continue;
    }
    if (node.nodeType === 3 && (node as Text).data.trim() === "" && !paragraph) continue;
    if (node.nodeName === "BR" && !paragraph) continue;
    paragraph ??= result.appendChild(doc.createElement("p"));
    paragraph.appendChild(node);
  }
  // Paragraphs with nothing in them at all, as reading `<p><ul>` back leaves around the list, take no line.
  for (const empty of [...result.querySelectorAll("p")]) {
    if (empty.childElementCount === 0 && (empty.textContent ?? "").trim() === "") empty.remove();
  }
  if (options.keepEmpty) return result.innerHTML;
  // Paragraphs a browser leaves empty when a line is deleted aren't the text's.
  for (const empty of [...result.querySelectorAll("p")]) {
    if (empty.textContent?.trim() === "" && [...empty.children].every((child) => child.tagName === "BR")) empty.remove();
  }
  return result.innerHTML;
}

/** Where the selection starts and ends while text is tidied: characters no one types, kept in the text for a moment. */
const START = "\uE000";
const END = "\uE001";

/** Finds a marker in `element`'s text, takes it out, and says where it was. */
function takeMarker(element: HTMLElement, marker: string): { node: Text; offset: number } | null {
  const walker = element.ownerDocument.createTreeWalker(element, 4 /* NodeFilter.SHOW_TEXT */);
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const offset = node.data.indexOf(marker);
    if (offset === -1) continue;
    node.data = node.data.slice(0, offset) + node.data.slice(offset + 1);
    return { node, offset };
  }
  return null;
}

/**
 * Puts the rich text being edited in `element` in the form it's kept in, where
 * the browser's editing left more: Chrome wraps text in `<span style>` to keep
 * how it looked when it makes a list or a heading of it, or joins two
 * paragraphs, and can leave a list in a paragraph. The selection stays where
 * it was. Empty paragraphs stay, since one may be the line just started.
 * Returns whether anything changed.
 */
export function tidyRichText(element: HTMLElement): boolean {
  const doc = element.ownerDocument;
  if (cleanRichText(element.innerHTML, doc, { keepEmpty: true }) === element.innerHTML) return false;
  const selection = doc.getSelection();
  const range =
    selection && selection.rangeCount > 0 && element.contains(selection.getRangeAt(0).commonAncestorContainer)
      ? selection.getRangeAt(0)
      : null;
  if (range) {
    const end = range.cloneRange();
    end.collapse(false);
    end.insertNode(doc.createTextNode(END));
    const start = range.cloneRange();
    start.collapse(true);
    start.insertNode(doc.createTextNode(START));
  }
  element.innerHTML = cleanRichText(element.innerHTML, doc, { keepEmpty: true });
  const start = takeMarker(element, START);
  const end = takeMarker(element, END);
  if (selection && start) {
    const restored = doc.createRange();
    restored.setStart(start.node, start.offset);
    if (end) restored.setEnd(end.node, end.offset);
    else restored.collapse(true);
    selection.removeAllRanges();
    selection.addRange(restored);
  }
  return true;
}
