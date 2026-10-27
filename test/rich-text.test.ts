/** Rich text keeps only what Puck's rich text editor makes, whatever a browser or a paste adds. */
import { describe, expect, it } from "vitest";
import { escapeText, itemSummary, tableRows } from "../src/fields.js";
import { cleanRichText, isSafeAddress } from "../src/rich-text.js";

const clean = (html: string) => cleanRichText(html, document);

describe("rich text", () => {
  it("keeps paragraphs, headings, lists, links and formatting as they are", () => {
    const html = '<h2>Title</h2><p>One <strong>two</strong> <em>three</em> <a href="/about">four</a></p><ul><li>Five</li></ul>';
    expect(clean(html)).toBe(html);
  });

  it("uses Puck's elements for bold, italic and struck-out text", () => {
    expect(clean("<p><b>a</b><i>b</i><strike>c</strike></p>")).toBe("<p><strong>a</strong><em>b</em><s>c</s></p>");
  });

  it("drops scripts, styles, attributes and unsafe links, keeping the words", () => {
    expect(
      clean(
        '<p class="x" style="color:red" onclick="x()">Hi <span style="font-weight:700">there</span><script>alert(1)</script></p><a href="javascript:alert(1)">link</a>',
      ),
    ).toBe("<p>Hi there</p><p><a>link</a></p>");
  });

  it("puts words a browser leaves outside a paragraph in one, and makes its new lines paragraphs", () => {
    expect(clean("Hello<div>World</div>")).toBe("<p>Hello</p><p>World</p>");
    expect(clean("<p>One</p><p><br></p>")).toBe("<p>One</p>");
  });

  it("takes addresses on the site, the web, email and phone, and nothing else", () => {
    for (const address of ["/about", "#top", "https://example.org", "mailto:a@example.org", "tel:555-0100", "../up"]) {
      expect(isSafeAddress(address)).toBe(true);
    }
    for (const address of ["javascript:alert(1)", "//evil.example", "data:text/html,x", "vbscript:x"]) {
      expect(isSafeAddress(address)).toBe(false);
    }
  });

  it("is made from pasted plain text, paragraph by paragraph", () => {
    expect(escapeText("One\nline\n\nTwo <b>")).toBe("<p>One<br>line</p><p>Two &lt;b&gt;</p>");
  });
});

describe("the sidebar's fields", () => {
  it("name a list's items by their first words", () => {
    const fields = { src: { type: "text", metadata: { media: "image" as const } }, caption: { type: "text" } };
    expect(itemSummary(fields, { src: "/media/a.jpg", caption: "A church" }, 0)).toBe("A church");
    expect(itemSummary(fields, { src: "/media/a.jpg", caption: "" }, 1)).toBe("Item 2");
  });

  it("make a table's rows the same length", () => {
    expect(tableRows([["a", "b"], ["c"]])).toEqual([
      ["a", "b"],
      ["c", ""],
    ]);
    expect(tableRows(undefined)).toEqual([]);
  });
});
