/**
 * What the editor keeps for the admin panel: its undo history, ids for the
 * blocks Gutenberg adds and duplicates, defaults for new blocks, and drawing
 * blocks from their fields where the site's code can't.
 */
import type { SiteDescription } from "@goodfellow-cms/core";
import { cloneBlock, createBlock } from "@wordpress/blocks";
import { describe, expect, it } from "vitest";
import { sessionRenderer } from "../src/admin.js";
import { fromGutenberg, toGutenberg, withBlockIds } from "../src/convert.js";
import { editHistory } from "../src/history.js";
import { registerBlocks } from "../src/register.js";

const description: Pick<SiteDescription, "blocks"> = {
  blocks: {
    Heading: {
      label: "Heading",
      fields: { text: { type: "text", label: "Text" }, level: { type: "select", options: [] } },
      defaultProps: { text: "Heading", level: "h2" },
    },
    Section: {
      label: "Section",
      fields: { content: { type: "slot" }, background: { type: "text" } },
      defaultProps: { content: [], background: "none" },
    },
  },
};
const edit = () => null;
const names = registerBlocks(description, { edit, slotEdit: edit, templates: true });

describe("the editor's history", () => {
  it("undoes and redoes changes, joining ones that replace the last", () => {
    const history = editHistory("a");
    const seen: string[] = [];
    history.subscribe(() => seen.push(history.present));
    history.push("b");
    history.replace("bc");
    history.push("d");
    expect([history.canUndo, history.canRedo]).toEqual([true, false]);
    expect(history.undo()).toBe("bc");
    expect(history.undo()).toBe("a");
    expect(history.undo()).toBeUndefined();
    expect(history.redo()).toBe("bc");
    history.push("e");
    expect(history.canRedo).toBe(false);
    expect(seen).toEqual(["b", "bc", "d", "bc", "a", "bc", "e"]);
  });
});

describe("blocks added in Gutenberg", () => {
  it("start with the site's defaults for them, without their slots", () => {
    const block = createBlock(names.toGutenberg("Section") as string);
    expect(block.attributes).toEqual({ props: { background: "none" } });
  });

  it("get ids of their own, as do the copies Gutenberg duplicates", () => {
    const [section] = toGutenberg(
      [
        {
          type: "Section",
          props: { id: "Section-1", background: "none", content: [{ type: "Heading", props: { id: "Heading-1" } }] },
        },
      ],
      description,
      names,
    );
    if (!section) throw new Error("No section");
    const added = createBlock(names.toGutenberg("Heading") as string);
    const blocks = [section, cloneBlock(section), added];
    const withIds = withBlockIds(blocks, names);
    const content = fromGutenberg(withIds, description, names);
    const ids = [content[0], content[1], content[2]].map((block) => block?.props.id);
    expect(ids[0]).toBe("Section-1");
    expect(ids[1]).toMatch(/^Section-/);
    expect(ids[2]).toMatch(/^Heading-/);
    expect(new Set(ids).size).toBe(3);
    // The copy's heading got an id of its own too, and the original's kept its own.
    const headings = content.map((block) => (block.props.content as { props: { id: string } }[] | undefined)?.[0]);
    expect(headings[0]?.props.id).toBe("Heading-1");
    expect(headings[1]?.props.id).not.toBe("Heading-1");
    // A section has one slot, so its heading is straight inside it, with no slot block.
    expect(withIds[0]?.innerBlocks[0]?.name).toBe(names.toGutenberg("Heading"));
  });

  it("are the same list when every block has an id of its own", () => {
    const blocks = toGutenberg([{ type: "Heading", props: { id: "Heading-1" } }], description, names);
    expect(withBlockIds(blocks, names)).toBe(blocks);
  });
});

describe("drawing blocks", () => {
  it("draws from the fields alone where the site's code can't", async () => {
    const renderer = sessionRenderer({
      blocks: description.blocks,
      draw: async ({ type }) => {
        if (type === "Heading") return "<h2>Drawn</h2>";
        throw new Error("Not one of the site's blocks");
      },
    });
    expect(await renderer.render({ type: "Heading", props: { id: "Heading-1" } })).toBe("<h2>Drawn</h2>");
    expect(
      await renderer.render({ type: "Section", props: { id: "Section-1", background: "light" } }),
    ).toContain('<gf-slot data-slot="content"></gf-slot>');
  });
});
