/** HTML pasted onto the canvas becomes the site's blocks, through Goodfellow's own conversion. */
import { join } from "node:path";
import type { GoodfellowConfig } from "@goodfellow-cms/core";
import { describeSite } from "@goodfellow-cms/react";
import { describe, expect, it } from "vitest";
import { fromGutenberg } from "../src/convert.js";
import { isIntoText, pastedBlocks } from "../src/paste.js";
import { registerBlocks } from "../src/register.js";
import { siteDir } from "../sites.js";

const config = ((await import(join(siteDir("starter"), "goodfellow.config.tsx"))) as { default: GoodfellowConfig })
  .default;
const description = describeSite(config);
const edit = () => null;
const names = registerBlocks(description, { edit, slotEdit: edit });

describe("pasting", () => {
  it("makes headings, text and pictures the site's blocks", () => {
    const blocks = pastedBlocks(
      {
        html: '<h2>Our history</h2><p>Founded <strong>long</strong> ago.</p><img src="https://example.org/a.jpg" alt="A church">',
        text: "",
      },
      description,
      names,
    );
    const content = fromGutenberg(blocks, description, names);
    expect(content.map((block) => block.type)).toEqual(["Heading", "Text", "Image"]);
    expect(content[0]?.props.text).toBe("Our history");
    expect(content[1]?.props.content).toContain("<strong>long</strong>");
    expect(new Set(content.map((block) => block.props.id)).size).toBe(3);
  });

  it("makes plain text paragraphs", () => {
    const content = fromGutenberg(pastedBlocks({ html: "", text: "One\n\nTwo" }, description, names), description, names);
    expect(content.map((block) => block.type)).toEqual(["Text"]);
    expect(content[0]?.props.content).toContain("Two");
  });

  it("keeps copied blocks' props only as the site's fields take them", () => {
    const name = names.toGutenberg("Text");
    const props = {
      id: "Text-1",
      content: '<p>ok</p><img src=x onerror="alert(1)"><style>p{}</style>',
      extra: 1,
      className: { not: "words" },
    };
    const html = `<!-- wp:${name} ${JSON.stringify({ props })} /-->`;
    const content = fromGutenberg(pastedBlocks({ html, text: "" }, description, names), description, names);
    expect(content.map((block) => block.type)).toEqual(["Text"]);
    const kept: Record<string, unknown> = content[0]?.props ?? {};
    expect(kept.content).toContain("<p>ok</p>");
    expect(kept.content).not.toMatch(/onerror|<style|<img/);
    expect(kept).not.toHaveProperty("extra");
    expect(kept.className).not.toEqual({ not: "words" });
  });

  it("leaves pasting into text being edited to the text", () => {
    const element = document.createElement("div");
    element.innerHTML = '<h2 data-gf-field="text"><span>x</span></h2><div class="gf-block"></div>';
    expect(isIntoText(element.querySelector("span"))).toBe(true);
    expect(isIntoText(element.querySelector(".gf-block"))).toBe(false);
  });
});
