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

/** `html` with only what rich text keeps, and any words outside a paragraph put in one. */
export function cleanRichText(html: string, doc: Document): string {
  const template = doc.createElement("template");
  template.innerHTML = html;
  const cleaned = doc.createElement("div");
  cleanChildren(template.content, cleaned, doc);

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
  // Paragraphs a browser leaves empty when a line is deleted aren't the text's.
  for (const empty of [...result.querySelectorAll("p")]) {
    if (empty.textContent?.trim() === "" && [...empty.children].every((child) => child.tagName === "BR")) empty.remove();
  }
  return result.innerHTML;
}
