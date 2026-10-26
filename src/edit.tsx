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
import { useBlockProps, useInnerBlocksProps } from "@wordpress/block-editor";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GoodfellowAttributes, SlotAttributes } from "./convert.js";
import { BlockFields } from "./fields.js";
import { type BlockNames, slotNames } from "./names.js";
import type { EditProps } from "./register.js";

/** The block the renderer draws in each slot's place: an empty `<gf-slot data-slot="…">`. */
export const SLOT_PLACEHOLDER = "GoodfellowSlotPlaceholder";

/** Draws one block, with its slots as placeholders, as the site would: the frame with the site's code answers. */
export interface BlockRenderer {
  render(block: ComponentData): Promise<string>;
}

/** Where each of a block's slots is in the HTML drawn for it, by slot. */
const SlotPlaces = createContext<ReadonlyMap<string, Element>>(new Map());


/** The block as the renderer is asked to draw it: its props, and a placeholder in each slot. */
function withPlaceholders(type: string, props: Record<string, unknown>, slots: string[]): ComponentData {
  const placeholders = Object.fromEntries(
    slots.map((slot) => [slot, [{ type: SLOT_PLACEHOLDER, props: { id: `${String(props.id)}-${slot}`, slot } }]]),
  );
  return { type, props: { ...props, ...placeholders } } as ComponentData;
}

/** The `edit` and `slotEdit` components for `registerBlocks()`, drawing blocks with `renderer`. */
export function blockEditors(description: Pick<SiteDescription, "blocks">, names: BlockNames, renderer: BlockRenderer) {
  function GoodfellowEdit({ name, attributes, setAttributes }: EditProps) {
    const type = names.fromGutenberg(name) as string;
    const slots = useMemo(() => slotNames(description.blocks[type]), [type]);
    const props = (attributes as GoodfellowAttributes).props;
    const key = JSON.stringify(props);
    const [html, setHtml] = useState<string>();
    useEffect(() => {
      let current = true;
      renderer.render(withPlaceholders(type, JSON.parse(key), slots)).then(
        (drawn) => current && setHtml(drawn),
        () => current && setHtml(`<p>${description.blocks[type]?.label ?? type}</p>`),
      );
      return () => {
        current = false;
      };
    }, [type, key, slots]);

    // The drawn HTML is the renderer's, not React's, so it's put in place by hand, then its slots found.
    const drawn = useRef<HTMLDivElement>(null);
    const [places, setPlaces] = useState<ReadonlyMap<string, Element>>(new Map());
    useLayoutEffect(() => {
      const element = drawn.current;
      if (!element || html === undefined) return;
      element.innerHTML = html;
      setPlaces(
        new Map(
          [...element.querySelectorAll("gf-slot[data-slot]")].map((place) => [
            place.getAttribute("data-slot") as string,
            place,
          ]),
        ),
      );
    }, [html]);

    const blockProps = useBlockProps({ className: "gf-block" });
    // The slots are blocks of their own, which draw themselves into their places: their list shows nothing.
    const innerBlocksProps = useInnerBlocksProps(
      { className: "gf-slot-list" },
      { templateLock: "all", renderAppender: false },
    );
    return (
      <div {...blockProps}>
        <BlockFields
          fields={description.blocks[type]?.fields ?? {}}
          props={props}
          onChange={(next) => setAttributes({ props: next })}
        />
        <div ref={drawn} className="gf-block-html" />
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
