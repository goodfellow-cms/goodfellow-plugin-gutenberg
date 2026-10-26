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
import { BlockControls, useBlockProps, useInnerBlocksProps } from "@wordpress/block-editor";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GoodfellowAttributes, SlotAttributes } from "./convert.js";
import { BlockFields, pasteRichText } from "./fields.js";
import { type InPlaceField, inPlaceFields, placeInPlace, readValue, withMarkers, writeValue } from "./in-place.js";
import { cleanRichText } from "./rich-text.js";
import { RichTextTools } from "./rich-text-tools.js";
import type { BlockNames } from "./names.js";
import type { EditProps } from "./register.js";

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

/** The `edit` and `slotEdit` components for `registerBlocks()`, drawing blocks with `renderer`. */
export function blockEditors(description: Pick<SiteDescription, "blocks">, names: BlockNames, renderer: BlockRenderer) {
  function GoodfellowEdit({ name, attributes, setAttributes, isSelected }: EditProps) {
    const type = names.fromGutenberg(name) as string;
    const props = (attributes as GoodfellowAttributes).props;
    const fields = description.blocks[type]?.fields ?? {};
    const inPlace = useMemo(() => inPlaceFields(fields), [fields]);
    // Fields edited in place are drawn as markers, so typing in them never draws the block again.
    const key = JSON.stringify(withMarkers(props, inPlace));
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
    const latest = useRef({ props, setAttributes });
    latest.current = { props, setAttributes };

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
            const value = editedValue(editable, field);
            if (value !== now[field.name]) set({ props: { ...now, [field.name]: value } });
          },
          { signal },
        );
        if (field.type === "text") {
          // One line: Enter ends it, as in the sidebar.
          editable.addEventListener("keydown", (event) => event.key === "Enter" && event.preventDefault(), { signal });
        }
        if (field.type === "richtext") editable.addEventListener("paste", pasteRichText, { signal });
      }
      setEditing(placed);
      return () => listening.abort();
    }, [html, inPlace]);

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
    const blockProps = useBlockProps({ className: "gf-block" });
    // The slots are blocks of their own, which draw themselves into their places: their list shows nothing.
    const innerBlocksProps = useInnerBlocksProps(
      { className: "gf-slot-list" },
      { templateLock: "all", renderAppender: false },
    );
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
          hidden={new Set(richText.map((field) => field.name))}
          onChange={(next) => setAttributes({ props: next })}
        />
        <div ref={drawn} className="gf-block-html" onClickCapture={stayOnCanvas} onSubmitCapture={stayOnCanvas} />
        <SlotPlaces.Provider value={places}>
          <div {...innerBlocksProps} />
        </SlotPlaces.Provider>
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
