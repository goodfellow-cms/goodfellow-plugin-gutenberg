/**
 * How the site's blocks look in Gutenberg's editor: each is drawn from the HTML
 * Goodfellow's own renderer gives for it, in a frame of its own that has the
 * blocks' code (this plugin never does), with each slot left as an empty
 * `<gf-slot>` where it belongs in the block's layout. Each slot's blocks are
 * then drawn into that place, so a block with several slots, or a slot inside
 * columns, looks as it does on the site while every block in it stays
 * Gutenberg's to select, edit and move.
 */
import type { SiteDescription } from "@goodfellow-cms/core";
import type { ComponentData } from "@puckeditor/core";
import { BlockControls, store as blockEditorStore, useBlockProps, useInnerBlocksProps } from "@wordpress/block-editor";
import { createBlock, getDefaultBlockName } from "@wordpress/blocks";
import { useRegistry } from "@wordpress/data";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type GoodfellowAttributes, type SlotAttributes, withoutHiddenClasses, withStyleClasses } from "./convert.js";
import { BlockFields, pasteRichText } from "./fields.js";
import { type InPlaceField, inPlaceFields, placeInPlace, readValue, withMarkers, writeValue } from "./in-place.js";
import { cleanRichText, tidyRichText } from "./rich-text.js";
import { RichTextTools } from "./rich-text-tools.js";
import { type BlockNames, onlySlot } from "./names.js";
import { type EditProps, hasClassName } from "./register.js";

/** What a drawn block leaves in each slot's place, as Goodfellow's `DRAWN_SLOT_ELEMENT`: `<gf-slot data-slot="…">`. */
export const SLOT_ELEMENT = "gf-slot";

/**
 * Draws one block as the site draws it, with each of its slots left as an
 * empty `SLOT_ELEMENT` where the slot's blocks go, as an editor plugin's
 * `session.draw()` does: the admin panel's frame with the site's code answers.
 */
export interface BlockRenderer {
  render(block: ComponentData): Promise<string>;
}

/** Where each of a block's slots is in the HTML drawn for it, by slot. */
const SlotPlaces = createContext<ReadonlyMap<string, Element>>(new Map());

/** A field's value as it's kept, from the element it's edited in. */
function editedValue(element: HTMLElement, field: InPlaceField): string {
  const value = readValue(element, field);
  return field.type === "richtext" ? cleanRichText(value, element.ownerDocument) : value;
}

/** Links and forms in drawn blocks are the site's: on the canvas, they go nowhere. */
function stayOnCanvas(event: { target: EventTarget | null; type: string; preventDefault(): void }) {
  const target = event.target as Element | null;
  if (event.type === "submit" || target?.closest?.("a[href]")) event.preventDefault();
}

/** How soon after a block is added its text is ready to type in, in milliseconds: the site draws it first. */
const JUST_ADDED = 5_000;

interface BlockStore {
  getBlockRootClientId(clientId: string): string | null;
  getBlockIndex(clientId: string): number;
  canInsertBlockType(name: string, rootClientId?: string | null): boolean;
}

interface BlockChanges {
  insertBlocks(
    blocks: unknown[],
    index: number,
    rootClientId?: string | null,
    updateSelection?: boolean,
    initialPosition?: number,
  ): void;
}

/** The `edit` and `slotEdit` components for `registerBlocks()`, drawing blocks with `renderer`. */
export function blockEditors(description: Pick<SiteDescription, "blocks">, names: BlockNames, renderer: BlockRenderer) {
  /**
   * Enter at the end of a one-line field, such as a heading's, adds the
   * site's Text after the block, empty, as Enter adds a paragraph in WordPress.
   */
  function addAfter(registry: ReturnType<typeof useRegistry>, clientId: string) {
    const name = getDefaultBlockName();
    const store = registry.select(blockEditorStore) as unknown as BlockStore;
    const rootClientId = store.getBlockRootClientId(clientId);
    if (!name || !store.canInsertBlockType(name, rootClientId)) return;
    const block = createBlock(name) as { attributes: { props?: Record<string, unknown> } };
    const fields = description.blocks[names.fromGutenberg(name) as string]?.fields ?? {};
    const empty = Object.fromEntries(inPlaceFields(fields).map((field) => [field.name, ""]));
    block.attributes.props = { ...block.attributes.props, ...empty };
    (registry.dispatch(blockEditorStore) as unknown as BlockChanges).insertBlocks(
      [block],
      store.getBlockIndex(clientId) + 1,
      rootClientId,
      true,
      0,
    );
  }

  function GoodfellowEdit({ name, attributes, setAttributes, isSelected, clientId }: EditProps) {
    const registry = useRegistry();
    const type = names.fromGutenberg(name) as string;
    const props = (attributes as GoodfellowAttributes).props;
    const fields = description.blocks[type]?.fields ?? {};
    const inPlace = useMemo(() => inPlaceFields(fields), [fields]);
    // Drawn with what's chosen in the Styles tab as the classes it's published as, but for the ones that hide it on
    // some screens: Gutenberg hides it itself where the editor's width is one of them, and shows it while selected.
    const styled = hasClassName(description.blocks[type])
      ? withoutHiddenClasses(withStyleClasses(props, attributes as unknown as Record<string, unknown>))
      : props;
    // Fields edited in place are drawn as markers, so typing in them never draws the block again.
    const key = JSON.stringify(withMarkers(styled, inPlace));
    const [html, setHtml] = useState<string>();
    useEffect(() => {
      let current = true;
      // Its props alone: the blocks in its slots are Gutenberg's, drawn into the places the drawing leaves.
      renderer.render({ type, props: JSON.parse(key) } as ComponentData).then(
        (drawn) => current && setHtml(drawn),
        () => current && setHtml(`<p>${description.blocks[type]?.label ?? type}</p>`),
      );
      return () => {
        current = false;
      };
    }, [type, key]);

    // The latest props, for edits made in the drawn HTML, which isn't React's.
    const latest = useRef({ props, setAttributes, clientId });
    latest.current = { props, setAttributes, clientId };
    const added = useRef(Date.now());

    // The drawn HTML is the renderer's, not React's, so it's put in place by hand, then its slots and text found.
    const drawn = useRef<HTMLDivElement>(null);
    const [places, setPlaces] = useState<ReadonlyMap<string, Element>>(new Map());
    const [editing, setEditing] = useState<ReadonlyMap<string, HTMLElement>>(new Map());
    useLayoutEffect(() => {
      const element = drawn.current;
      if (!element || html === undefined) return;
      element.innerHTML = html;
      setPlaces(
        new Map(
          [...element.querySelectorAll(`${SLOT_ELEMENT}[data-slot]`)].map((place) => [
            place.getAttribute("data-slot") as string,
            place,
          ]),
        ),
      );
      const placed = placeInPlace(element, inPlace, latest.current.props);
      const listening = new AbortController();
      for (const field of inPlace) {
        const editable = placed.get(field.name);
        if (!editable) continue;
        const { signal } = listening;
        editable.addEventListener(
          "input",
          () => {
            const { props: now, setAttributes: set } = latest.current;
            // What the browser's editing wrapped the text in comes out of the element too, not only what's kept.
            if (field.type === "richtext") tidyRichText(editable);
            const value = editedValue(editable, field);
            if (value !== now[field.name]) set({ props: { ...now, [field.name]: value } });
          },
          { signal },
        );
        editable.addEventListener(
          "keydown",
          (event) => {
            if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
            // Gutenberg's own Enter, which adds a block after this one, is the plugin's to decide on.
            event.stopPropagation();
            if (field.type !== "text") return;
            // One line: Enter ends it, and starts the next block.
            event.preventDefault();
            addAfter(registry, latest.current.clientId);
          },
          { signal },
        );
        // Gutenberg makes a new block of a new paragraph, as it does in its own paragraphs; here it's a new line.
        editable.addEventListener(
          "beforeinput",
          (event) => {
            if (event.inputType === "insertParagraph" || event.inputType === "insertLineBreak") event.stopPropagation();
          },
          { signal },
        );
        if (field.type === "richtext") editable.addEventListener("paste", pasteRichText, { signal });
      }
      setEditing(placed);
      return () => listening.abort();
    }, [html, inPlace, registry]);

    // A block just added, once the site has drawn it, has its first text ready to type in, as Gutenberg's blocks do;
    // where that's still the block's own example text, it's selected, so typing replaces it.
    useEffect(() => {
      if (!isSelected || Date.now() - added.current > JUST_ADDED) return;
      const field = inPlace.find((candidate) => editing.has(candidate.name));
      const element = field && editing.get(field.name);
      const wrapper = drawn.current?.closest("[data-block]");
      if (!field || !element || !wrapper) return;
      const doc = element.ownerDocument;
      const active = doc.activeElement;
      if (active && active !== wrapper && active !== doc.body && wrapper.contains(active)) return;
      added.current = 0;
      element.focus();
      const range = doc.createRange();
      range.selectNodeContents(element);
      const example = description.blocks[type]?.defaultProps?.[field.name];
      if (!(typeof example === "string" && example && latest.current.props[field.name] === example)) range.collapse(false);
      doc.getSelection()?.removeAllRanges();
      doc.getSelection()?.addRange(range);
    }, [isSelected, editing, inPlace, type]);

    // Changes made elsewhere (the sidebar, Undo, the AI assistant) shown where the text is edited.
    useEffect(() => {
      for (const field of inPlace) {
        const editable = editing.get(field.name);
        if (editable && editedValue(editable, field) !== (props[field.name] ?? "")) {
          writeValue(editable, field, props[field.name]);
        }
      }
    }, [props, editing, inPlace]);

    const richText = inPlace.filter((field) => field.type === "richtext" && editing.has(field.name));
    // Gutenberg puts what's chosen in its styling options on the block's wrapper too, as its own classes and styles,
    // which the drawn block has already, as Tailwind classes: the wrapper keeps only Gutenberg's own.
    const { style: _chosen, ...wrapperProps } = useBlockProps({ className: "gf-block" }) as { style?: unknown; className?: string };
    const extra = new Set(String((attributes as { className?: unknown }).className ?? "").split(/\s+/).filter(Boolean));
    const blockProps = {
      ...wrapperProps,
      className: String(wrapperProps.className ?? "")
        .split(/\s+/)
        .filter((name) => name && !extra.has(name) && !/^(has-|wp-elements-)/.test(name))
        .join(" "),
    };
    // A block with several slots has a slot block for each, which draw themselves into their places, so their list
    // shows nothing; one with only one slot draws the blocks in it into its place itself.
    const only = onlySlot(description.blocks[type]);
    const innerBlocksProps = useInnerBlocksProps(
      { className: only ? "gf-slot" : "gf-slot-list" },
      only ? { templateLock: false } : { templateLock: "all", renderAppender: false },
    );
    const onlyPlace = only ? places.get(only) : undefined;
    return (
      <div {...blockProps}>
        {isSelected && richText.length > 0 && (
          <BlockControls group="block">
            <RichTextTools
              elements={() => richText.flatMap((field) => editing.get(field.name) ?? [])}
            />
          </BlockControls>
        )}
        <BlockFields
          fields={fields}
          props={props}
          // Its CSS classes are Gutenberg's styling options and additional CSS classes, under Advanced.
          hidden={new Set([...richText.map((field) => field.name), "className"])}
          onChange={(next) => setAttributes({ props: next })}
        />
        <div ref={drawn} className="gf-block-html" onClickCapture={stayOnCanvas} onSubmitCapture={stayOnCanvas} />
        {only ? (
          // Until the block is drawn, there's nowhere to put them.
          onlyPlace && createPortal(<div {...innerBlocksProps} />, onlyPlace)
        ) : (
          <SlotPlaces.Provider value={places}>
            <div {...innerBlocksProps} />
          </SlotPlaces.Provider>
        )}
      </div>
    );
  }

  function SlotEdit({ attributes }: EditProps) {
    const place = useContext(SlotPlaces).get((attributes as SlotAttributes).slot);
    const blockProps = useBlockProps({ className: "gf-slot" });
    const innerBlocksProps = useInnerBlocksProps(blockProps, { templateLock: false });
    // Until the block around it is drawn, there's nowhere to put it.
    if (!place) return null;
    return createPortal(<div {...innerBlocksProps} />, place);
  }

  return { edit: GoodfellowEdit, slotEdit: SlotEdit };
}
