/**
 * Gutenberg's "Transform to" between the site's blocks: words go across, as
 * plain text where the new block's field is plain, with the block's classes.
 */
import type { SiteDescription } from "@goodfellow-cms/core";
import { type Block, createBlock, getBlockType, switchToBlockType } from "@wordpress/blocks";
import { describe, expect, it } from "vitest";
import { fromGutenberg } from "../src/convert.js";
import { registerBlocks } from "../src/register.js";
import { wordsFor } from "../src/transforms.js";

const description: Pick<SiteDescription, "blocks"> = {
  blocks: {
    Text: {
      label: "Text",
      fields: {
        text: { type: "richtext", label: "Text", contentEditable: true },
        className: { type: "text" },
      },
      defaultProps: { text: "<p>Some words</p>", className: "" },
    },
    Heading: {
      label: "Heading",
      fields: {
        text: { type: "text", label: "Text", contentEditable: true },
        level: { type: "select", options: [{ value: "h2" }, { value: "h3" }] },
        className: { type: "text" },
      },
      defaultProps: { text: "Heading", level: "h2", className: "" },
    },
    Section: {
      label: "Section",
      fields: { content: { type: "slot" }, className: { type: "text" } },
      defaultProps: { content: [], className: "" },
    },
  },
};
const edit = () => null;
const names = registerBlocks(description, { edit, slotEdit: edit, templates: true });
const name = (type: string) => names.toGutenberg(type) as string;

function transformed(block: Block, type: string) {
  const result = switchToBlockType(block, name(type)) as Block[] | null;
  if (!result) throw new Error(`No transform to ${type}`);
  return fromGutenberg(result, description, names);
}

describe("transforms", () => {
  it("turns text into a heading and back, the words as each field keeps them, with the block's classes", () => {
    const text = createBlock(name("Text"), {
      props: { id: "t", text: "<p>Visit <strong>us</strong> &amp; stay</p>", className: "mt-8" },
      className: "mt-8",
    });
    const [heading] = transformed(text, "Heading");
    expect(heading).toMatchObject({
      type: "Heading",
      props: { text: "Visit us & stay", level: "h2", className: "mt-8" },
    });
    const back = createBlock(name("Heading"), { props: { text: "Fish & <chips>", level: "h3" } });
    expect(transformed(back, "Text")[0]?.props.text).toBe("<p>Fish &amp; &lt;chips&gt;</p>");
  });

  it("offers none to or from blocks with slots, or whose words aren't one field", () => {
    const transforms = (type: string) =>
      (getBlockType(name(type)) as { transforms?: { to?: { blocks: string[] }[] } }).transforms?.to ?? [];
    expect(transforms("Text").map((transform) => transform.blocks)).toEqual([[name("Heading")]]);
    expect(transforms("Section")).toEqual([]);
  });

  it("keeps paragraphs and lines apart going into rich text, and one line going into a heading", () => {
    const plain = { name: "text", type: "textarea", label: "Text" } as const;
    const rich = { name: "text", type: "richtext", label: "Text" } as const;
    const line = { name: "text", type: "text", label: "Text" } as const;
    expect(wordsFor(plain, rich, "One\ntwo\n\nThree", document)).toBe("<p>One<br>two</p><p>Three</p>");
    expect(wordsFor(plain, line, "One\ntwo", document)).toBe("One two");
  });
});
