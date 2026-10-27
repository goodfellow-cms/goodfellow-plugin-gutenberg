/**
 * Formatting for rich text edited in the plugin's own elements, as Gutenberg's
 * toolbar shows it for its own rich text: bold, italic, links (to the site's
 * pages or anywhere), headings and lists. It works on the browser's selection,
 * in whichever of the elements holds it.
 */
import type { PageLink } from "@goodfellow-cms/core";
import { Button, Popover, TextControl, ToolbarButton, ToolbarDropdownMenu, ToolbarGroup } from "@wordpress/components";
import {
  formatBold,
  formatItalic,
  formatListBullets,
  formatListNumbered,
  heading,
  link as linkIcon,
  linkOff,
} from "@wordpress/icons";
import { createContext, useContext, useRef, useState } from "react";
import { isSafeAddress } from "./rich-text.js";

/** What the editor's fields need from the admin panel. */
export interface EditorServices {
  /** Opens the media library to choose a file of a kind, answering with its address, or `null`. */
  chooseMedia(kind: "image" | "video" | "audio" | "file", value?: string): Promise<string | null>;
  /** The site's pages, for links. */
  pages: readonly PageLink[];
}

export const Services = createContext<EditorServices>({ chooseMedia: async () => null, pages: [] });

/** The element the selection is in, of those given, with the selection's range. */
function selectionIn(elements: readonly HTMLElement[]): { element: HTMLElement; range: Range } | null {
  const selection = elements[0]?.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const element = elements.find((candidate) => candidate.contains(range.commonAncestorContainer));
  return element ? { element, range } : null;
}

/** Runs one of the browser's editing commands on the selection, if it's in one of the elements. */
function format(elements: readonly HTMLElement[], command: string, value?: string): void {
  const found = selectionIn(elements);
  if (!found) return;
  found.element.focus();
  found.element.ownerDocument.execCommand(command, false, value);
}

/** The link the selection is in, if any. */
function currentLink(elements: readonly HTMLElement[]): HTMLAnchorElement | null {
  const found = selectionIn(elements);
  const node = found?.range.startContainer;
  const element = node && (node.nodeType === 1 ? (node as Element) : node.parentElement);
  return (element?.closest("a") as HTMLAnchorElement | null) ?? null;
}

/** Buttons keep the selection where it is, rather than taking focus from the text. */
const keepSelection = { onMouseDown: (event: { preventDefault(): void }) => event.preventDefault() };

function LinkButton({ elements }: { elements: () => HTMLElement[] }) {
  const { pages } = useContext(Services);
  const anchor = useRef<HTMLDivElement>(null);
  const saved = useRef<Range | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [existing, setExisting] = useState(false);

  const open = () => {
    const found = selectionIn(elements());
    if (!found) return;
    saved.current = found.range.cloneRange();
    const link = currentLink(elements());
    setExisting(Boolean(link));
    setAddress(link?.getAttribute("href") ?? "");
  };
  const close = () => setAddress(null);
  const restore = () => {
    const range = saved.current;
    const selection = range?.startContainer.ownerDocument?.getSelection();
    if (!range || !selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  };
  const apply = (to: string) => {
    restore();
    if (isSafeAddress(to)) format(elements(), "createLink", to.trim());
    close();
  };
  const remove = () => {
    restore();
    const link = currentLink(elements());
    if (link) {
      // The whole link, wherever in it the selection was.
      const range = link.ownerDocument.createRange();
      range.selectNodeContents(link);
      const selection = link.ownerDocument.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    format(elements(), "unlink");
    close();
  };

  const typed = (address ?? "").trim().toLowerCase();
  const suggestions = typed
    ? pages.filter((page) => page.title.toLowerCase().includes(typed) || page.path.includes(typed)).slice(0, 6)
    : pages.slice(0, 6);
  return (
    <div ref={anchor} style={{ display: "contents" }}>
      <ToolbarButton icon={linkIcon} label="Link" isPressed={address !== null} onClick={open} {...keepSelection} />
      {existing && <ToolbarButton icon={linkOff} label="Remove link" onClick={remove} {...keepSelection} />}
      {address !== null && (
        <Popover anchor={anchor.current} onClose={close} placement="bottom-start" focusOnMount="firstElement">
          <form
            className="gf-link-form"
            onSubmit={(event) => {
              event.preventDefault();
              apply(address);
            }}
          >
            <TextControl
              __next40pxDefaultSize
              __nextHasNoMarginBottom
              label="Address, or a page's name"
              value={address}
              onChange={setAddress}
              help={address && !isSafeAddress(address) ? "Start the address with https://, or choose a page." : undefined}
            />
            {suggestions.length > 0 && (
              <ul className="gf-link-pages" aria-label="The site's pages">
                {suggestions.map((page) => (
                  <li key={page.path}>
                    <Button variant="tertiary" onClick={() => apply(page.path)}>
                      {page.title} <span className="gf-link-path">{page.path}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="gf-link-actions">
              <Button variant="primary" type="submit" disabled={!isSafeAddress(address)}>
                {existing ? "Change link" : "Add link"}
              </Button>
              <Button variant="tertiary" onClick={close}>
                Cancel
              </Button>
            </div>
          </form>
        </Popover>
      )}
    </div>
  );
}

/** The formatting buttons, for the block's toolbar or above the sidebar's rich text. */
export function RichTextTools({ elements }: { elements: () => HTMLElement[] }) {
  const run = (command: string, value?: string) => () => format(elements(), command, value);
  return (
    <>
      <ToolbarGroup>
        <ToolbarDropdownMenu
          icon={heading}
          label="Paragraph or heading"
          controls={[
            { title: "Paragraph", onClick: run("formatBlock", "p") },
            { title: "Heading 2", onClick: run("formatBlock", "h2") },
            { title: "Heading 3", onClick: run("formatBlock", "h3") },
            { title: "Heading 4", onClick: run("formatBlock", "h4") },
          ]}
        />
        <ToolbarButton icon={formatListBullets} label="List" onClick={run("insertUnorderedList")} {...keepSelection} />
        <ToolbarButton
          icon={formatListNumbered}
          label="Numbered list"
          onClick={run("insertOrderedList")}
          {...keepSelection}
        />
      </ToolbarGroup>
      <ToolbarGroup>
        <ToolbarButton icon={formatBold} label="Bold" onClick={run("bold")} {...keepSelection} />
        <ToolbarButton icon={formatItalic} label="Italic" onClick={run("italic")} {...keepSelection} />
        <LinkButton elements={elements} />
      </ToolbarGroup>
    </>
  );
}
