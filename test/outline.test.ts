import type { SiteDescription } from "@goodfellow-cms/core";
import type { ComponentData } from "@puckeditor/core";
import { describe, expect, it } from "vitest";
import { SLOT_PLACEHOLDER } from "../src/edit.js";
import { outlineRenderer } from "../src/outline.js";

const description = {
  blocks: {
    Section: {
      label: "Section",
      fields: { title: { type: "text", label: "Title" }, content: { type: "slot" }, aside: { type: "slot" } },
    },
  },
} as unknown as Pick<SiteDescription, "blocks">;

describe("drawing blocks from their fields alone", () => {
  it("shows the block's name, its words escaped, and a place for each slot in order", async () => {
    const html = await outlineRenderer(description).render({
      type: "Section",
      props: {
        id: "s",
        title: "Fish & <chips>",
        content: [{ type: SLOT_PLACEHOLDER, props: { id: "s-content", slot: "content" } }],
        aside: [{ type: SLOT_PLACEHOLDER, props: { id: "s-aside", slot: "aside" } }],
      },
    } as ComponentData);
    expect(html).toContain('<p class="gf-outline-name">Section</p>');
    expect(html).toContain("Fish &#38; &#60;chips&#62;");
    expect(html.indexOf('data-slot="content"')).toBeLessThan(html.indexOf('data-slot="aside"'));
  });
});
