/** Rich text keeps only what Puck's rich text editor makes, whatever a browser or a paste adds. */
import { describe, expect, it } from "vitest";
import { escapeText, itemSummary, tableRows } from "../src/fields.js";
import { CELL_SEPARATOR, cleanRichText, hasPictures, isSafeAddress, tidyRichText } from "../src/rich-text.js";

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

  it("keeps a pasted table's rows as paragraphs of their cells' words", () => {
    expect(
      clean("<table><caption>Times</caption><tr><th>Day</th><th>Mass</th></tr><tr><td>Sunday</td><td><b>9</b></td></tr></table>"),
    ).toBe(`<p>Times</p><p>Day${CELL_SEPARATOR}Mass</p><p>Sunday${CELL_SEPARATOR}<strong>9</strong></p>`);
  });

  it("keeps where a numbered list starts and which way it counts, and code's language", () => {
    expect(clean('<ol start="3" reversed type="a"><li>Three</li></ol>')).toBe('<ol start="3" reversed=""><li>Three</li></ol>');
    expect(clean('<ol start="x"><li>One</li></ol>')).toBe("<ol><li>One</li></ol>");
    expect(clean('<pre><code class="language-js other" data-x="1">let a;</code></pre>')).toBe(
      '<pre><code class="language-js">let a;</code></pre>',
    );
    expect(clean('<p><code class="language-js">a</code></p>')).toBe("<p><code>a</code></p>");
  });

  it("knows when what's pasted has pictures, which it leaves out", () => {
    expect(hasPictures('<p>A</p><img src="a.jpg">')).toBe(true);
    expect(clean('<p>A</p><img src="a.jpg">')).toBe("<p>A</p>");
    expect(hasPictures("<p>Imagine</p>")).toBe(false);
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

describe("rich text being edited", () => {
  const editing = (html: string) => {
    const element = document.createElement("div");
    element.contentEditable = "true";
    element.innerHTML = html;
    document.body.append(element);
    return element;
  };

  it("puts lists and headings a browser leaves in a paragraph beside it", () => {
    expect(clean("<p>Before<ul><li>One</li></ul>after</p>")).toBe("<p>Before</p><ul><li>One</li></ul><p>after</p>");
    expect(clean("<p><ol><li>One</li></ol></p>")).toBe("<ol><li>One</li></ol>");
    // As a browser's editing leaves it in the page, and as reading it back as HTML does.
    expect(cleanRichText("<p></p><ol><li>One</li></ol><p></p>", document, { keepEmpty: true })).toBe("<ol><li>One</li></ol>");
  });

  it("keeps the line just started while it's edited, but not in what's kept", () => {
    expect(cleanRichText("<p>One</p><p><br></p>", document, { keepEmpty: true })).toBe("<p>One</p><p><br></p>");
    expect(clean("<p>One</p><p><br></p>")).toBe("<p>One</p>");
  });

  it("takes out what the browser's editing wraps text in, keeping the selection where it was", () => {
    const element = editing(
      '<ul><li><span style="background-color: rgb(255, 255, 255); font-family: &quot;Source Sans 3&quot;;">First</span> item</li></ul>',
    );
    const text = element.querySelector("span")?.firstChild as Text;
    const selection = document.getSelection() as Selection;
    const range = document.createRange();
    range.setStart(text, 2);
    range.setEnd(text, 4);
    selection.removeAllRanges();
    selection.addRange(range);

    expect(tidyRichText(element)).toBe(true);
    expect(element.innerHTML).toBe("<ul><li>First item</li></ul>");
    expect(selection.toString()).toBe("rs");
    expect(tidyRichText(element)).toBe(false);
    element.remove();
  });

  it("keeps the selection where text has private-use characters of its own, such as an icon font's", () => {
    const element = editing('<p><span style="color: red;">\uE000 Call \uE001 us</span></p>');
    const text = element.querySelector("span")?.firstChild as Text;
    const selection = document.getSelection() as Selection;
    const range = document.createRange();
    range.setStart(text, 3);
    range.setEnd(text, 6);
    selection.removeAllRanges();
    selection.addRange(range);

    expect(tidyRichText(element)).toBe(true);
    expect(element.innerHTML).toBe("<p>\uE000 Call \uE001 us</p>");
    expect(selection.toString()).toBe("all");
    element.remove();
  });

  it("leaves rich text that's as it's kept alone", () => {
    const element = editing("<p>One <strong>two</strong></p><p><br></p>");
    expect(tidyRichText(element)).toBe(false);
    expect(element.innerHTML).toBe("<p>One <strong>two</strong></p><p><br></p>");
    element.remove();
  });
});
