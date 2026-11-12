/**
 * Text edited where it shows, on the canvas, as Puck edits fields marked
 * `contentEditable`: the plugin has none of the blocks' code, so it can't
 * tell where a block puts a field's text. Instead the block is drawn with a
 * marker in place of each such field's value, and the marker, wherever it
 * comes out in the drawn HTML, becomes the element the text is edited in. A
 * block that changes its text before showing it (cutting it short, say) loses
 * the marker, and that field is edited in the sidebar only.
 */
import type { Field } from "./fields.js";
import { cleanRichText, isSafeAddress, normalizedAddress } from "./rich-text.js";

/** The field types that can be edited in place. */
const IN_PLACE_TYPES = new Set(["text", "textarea", "richtext"]);

/** A field edited in place: its name, and whether it's one line, several, or rich text. */
export interface InPlaceField {
  name: string;
  type: "text" | "textarea" | "richtext";
  label: string;
}

/** The block's fields marked `contentEditable`, which Puck edits in place too. */
export function inPlaceFields(fields: Record<string, unknown>): InPlaceField[] {
  return (Object.entries(fields) as [string, Field & { contentEditable?: boolean }][])
    .filter(([, field]) => field.contentEditable === true && IN_PLACE_TYPES.has(field.type))
    .map(([name, field]) => ({ name, type: field.type as InPlaceField["type"], label: field.label ?? name }));
}

/** Made up anew each time the plugin loads, so no page can hold one already. */
const NONCE = Math.random().toString(36).slice(2, 10);

/** The marker drawn in place of a field's value: letters and digits only, which no renderer escapes or splits. */
export function marker(index: number): string {
  return `gfinplace${index}x${NONCE}`;
}

/** The block's props as they're drawn, with each field edited in place as its marker. */
export function withMarkers(props: Record<string, unknown>, fields: readonly InPlaceField[]): Record<string, unknown> {
  const drawn = { ...props };
  fields.forEach((field, index) => {
    if (props[field.name] === undefined || typeof props[field.name] === "string") drawn[field.name] = marker(index);
  });
  return drawn;
}

/** A field's value as plain text, for attributes, where the drawing put it in one. */
export function plainText(field: InPlaceField, value: unknown, doc: Document): string {
  const text = typeof value === "string" ? value : "";
  if (field.type !== "richtext") return text;
  const template = doc.createElement("template");
  template.innerHTML = text;
  return template.content.textContent ?? "";
}

/** Attributes a field's text never goes into: event handlers, styles and frames' pages, which would run or load it. */
function runsText(name: string): boolean {
  return /^on/.test(name) || name === "style" || name === "srcdoc";
}

/** Attributes that hold an address, which takes a field's text only where it makes one a page may have. */
const ADDRESS_ATTRIBUTES = new Set([
  "href",
  "xlink:href",
  "src",
  "srcset",
  "action",
  "formaction",
  "poster",
  "data",
  "cite",
  "background",
  "ping",
]);

/**
 * An address with no scheme of its own (`images/a.png`, `?page=2`), which the
 * page's address is the start of, so it can't run anything. Browsers read `\`
 * as `/`, so one starting with either is left to `isSafeAddress()`.
 */
function isRelativeAddress(address: string): boolean {
  const trimmed = normalizedAddress(address);
  if (/^[\\/]/.test(trimmed)) return false;
  const end = trimmed.search(/[/?#\\]/);
  return !(end === -1 ? trimmed : trimmed.slice(0, end)).includes(":");
}

/** Whether an address may stay in an attribute: one a page may have, or one with no scheme of its own. */
function keptAddress(address: string): boolean {
  return isSafeAddress(address) || isRelativeAddress(address);
}

/** HTML's ASCII whitespace, which separates a `srcset` candidate's address from its descriptors. */
const isSpace = (char: string) => char === " " || char === "\t" || char === "\n" || char === "\f" || char === "\r";

/**
 * A `srcset` with only the candidates whose address may stay, each with its
 * width or density as written. It's read as HTML reads it, in one pass: an
 * address runs to the next whitespace, commas included, less any commas it
 * ends with; its descriptors run to the next comma outside brackets.
 */
function srcsetWithKeptAddresses(srcset: string): string {
  const kept: string[] = [];
  let at = 0;
  while (at < srcset.length) {
    while (at < srcset.length && (isSpace(srcset.charAt(at)) || srcset.charAt(at) === ",")) at += 1;
    if (at >= srcset.length) break;
    const start = at;
    while (at < srcset.length && !isSpace(srcset.charAt(at))) at += 1;
    let url = srcset.slice(start, at);
    let descriptors = "";
    if (url.endsWith(",")) {
      // Commas ending the address end the candidate too, with no descriptors.
      url = url.replace(/,+$/, "");
    } else {
      const from = at;
      let depth = 0;
      while (at < srcset.length && (srcset.charAt(at) !== "," || depth > 0)) {
        if (srcset.charAt(at) === "(") depth += 1;
        else if (srcset.charAt(at) === ")" && depth > 0) depth -= 1;
        at += 1;
      }
      descriptors = srcset.slice(from, at).trimEnd();
    }
    if (url && keptAddress(url)) kept.push(`${normalizedAddress(url)}${descriptors}`);
  }
  return kept.join(", ");
}

/** A field's marker in the drawn HTML, and the text it stands for. */
export interface Fill {
  marker: string;
  text: string;
}

/**
 * An attribute's value with each field's text where the drawing put its
 * marker: the block filtered its addresses while the markers stood in for the
 * text, so an address is checked again once all the text is in it, and left
 * empty where it isn't one a page may have, such as `javascript:`, and what
 * runs or styles the page never takes the text at all.
 */
export function attributeWithText(name: string, value: string, fills: readonly Fill[]): string {
  const lower = name.toLowerCase();
  const runs = runsText(lower);
  let filled = value;
  for (const { marker, text } of fills) filled = filled.split(marker).join(runs ? "" : text);
  if (runs || !ADDRESS_ATTRIBUTES.has(lower)) return filled;
  if (lower === "srcset") return srcsetWithKeptAddresses(filled);
  return keptAddress(filled) ? normalizedAddress(filled) : "";
}

/** The element a marker could be edited in, where it's all its text node holds: its parent, while it holds nothing else, but never `root`. */
function wholeElement(node: Text, marker: string, root: Element): Element | null {
  let element = node.parentElement;
  if (!element || element === root || node.data.trim() !== marker) return null;
  if (onlyChild(element, node)) {
    // As high as it goes while each holds only the one before, so rich text replaces every wrapper around it.
    while (element.parentElement && element.parentElement !== root && onlyChild(element.parentElement, element)) {
      element = element.parentElement;
    }
    return element;
  }
  return null;
}

/** Whether `child` is all `parent` holds, apart from spaces. */
function onlyChild(parent: Element, child: Node): boolean {
  return [...parent.childNodes].every(
    (node) => node === child || (node.nodeType === 3 && (node as Text).data.trim() === ""),
  );
}

/**
 * Finds each field's marker in the drawn HTML under `root` and makes the
 * first of each the element its text is edited in, with the value in it:
 * attributes the marker went into, and any other copies of it, get the value
 * as plain text. Returns the elements, by field.
 */
export function placeInPlace(
  root: Element,
  fields: readonly InPlaceField[],
  values: Record<string, unknown>,
): Map<string, HTMLElement> {
  const doc = root.ownerDocument;
  const markers = fields.map((field, index) => ({ field, marker: marker(index), text: plainText(field, values[field.name], doc) }));
  const placed = new Map<string, HTMLElement>();
  if (markers.length === 0) return placed;

  for (const element of root.querySelectorAll("*")) {
    for (const attribute of [...element.attributes]) {
      const fills = markers.filter(({ marker }) => attribute.value.includes(marker));
      if (fills.length > 0) element.setAttribute(attribute.name, attributeWithText(attribute.name, attribute.value, fills));
    }
  }

  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) texts.push(node as Text);
  for (const node of texts) {
    for (const { field, marker, text } of markers) {
      if (!node.data.includes(marker)) continue;
      const whole = placed.has(field.name) ? null : wholeElement(node, marker, root);
      if (whole) {
        placed.set(field.name, editable(whole as HTMLElement, field, values[field.name]));
        break;
      }
      if (placed.has(field.name) || field.type === "richtext") {
        // A copy of the text, or rich text that shares its element with other words: shown, not edited here.
        node.data = node.data.split(marker).join(text);
        continue;
      }
      // One line or several among other words: edited in an element of its own, in the same place.
      const [before, ...rest] = node.data.split(marker);
      const span = doc.createElement("span");
      node.data = before ?? "";
      node.after(span, doc.createTextNode(rest.join(text)));
      placed.set(field.name, editable(span, field, values[field.name]));
      break;
    }
  }
  return placed;
}

/** Makes an element the one a field is edited in. */
function editable(element: HTMLElement, field: InPlaceField, value: unknown): HTMLElement {
  element.setAttribute("contenteditable", field.type === "richtext" ? "true" : "plaintext-only");
  element.setAttribute("data-gf-field", field.name);
  element.setAttribute("data-placeholder", field.label);
  element.setAttribute("aria-label", field.label);
  if (field.type !== "text") element.setAttribute("aria-multiline", "true");
  element.classList.add("gf-in-place", `gf-in-place-${field.type}`);
  writeValue(element, field, value);
  return element;
}

/** What's in an element a field is edited in, as the field keeps it. */
export function readValue(element: HTMLElement, field: InPlaceField): string {
  if (field.type === "richtext") return element.innerHTML;
  const lines: string[] = [];
  const read = (node: Node) => {
    if (node.nodeType === 3) lines.push((node as Text).data);
    else if (node.nodeName === "BR") lines.push("\n");
    else for (const child of node.childNodes) read(child);
  };
  read(element);
  const text = lines.join("");
  // A last line break a browser adds to keep an empty last line open isn't the text's.
  return field.type === "text" ? text.replace(/\n/g, " ") : text.replace(/\n$/, "");
}

/** Puts a field's value in the element it's edited in. */
export function writeValue(element: HTMLElement, field: InPlaceField, value: unknown): void {
  const text = typeof value === "string" ? value : "";
  // Cleaned as typed rich text is, since what's stored may have been written anywhere, such as by a collaborator.
  if (field.type === "richtext") element.innerHTML = cleanRichText(text, element.ownerDocument, { keepEmpty: true });
  else element.textContent = text;
}
