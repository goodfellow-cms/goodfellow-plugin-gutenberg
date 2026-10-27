/** Adding blocks: the "+" between two blocks, "/" in text, and blocks' icons. */
import { describe, expect, it } from "vitest";
import { iconShapes } from "../src/icons.js";
import { EDGE, gapAt } from "../src/inserters.js";
import { caretLine, slashMatches } from "../src/slash.js";

/** Three blocks one under another, 100 pixels tall, the middle one with two blocks of its own in a slot. */
function page() {
  const root = document.createElement("div");
  root.innerHTML = `
    <div data-block="a"></div>
    <div data-block="b"><div data-block="b-slot"><div data-block="b1"></div><div data-block="b2"></div></div></div>
    <div data-block="c"></div>`;
  const boxes: Record<string, [number, number]> = { a: [0, 100], b: [100, 200], "b-slot": [100, 200], b1: [100, 150], b2: [150, 200], c: [200, 300] };
  for (const element of root.querySelectorAll<HTMLElement>("[data-block]")) {
    const [top, bottom] = boxes[element.dataset.block as string] as [number, number];
    element.getBoundingClientRect = () => ({ top, bottom, left: 0, right: 500, width: 500, height: bottom - top, x: 0, y: top, toJSON: () => ({}) });
  }
  const parents: Record<string, string | null> = { a: null, b: null, c: null, "b-slot": "b", b1: "b-slot", b2: "b-slot" };
  const order: Record<string, string[]> = { "": ["a", "b", "c"], b: ["b-slot"], "b-slot": ["b1", "b2"] };
  const select = {
    getBlockRootClientId: (id: string) => parents[id] ?? null,
    getBlockOrder: (id?: string | null) => order[id ?? ""] ?? [],
    // A block's slots are fixed; the blocks in them aren't.
    getTemplateLock: (id?: string | null) => (id === "b" ? ("all" as const) : false),
    getBlockListSettings: () => undefined,
  };
  const at = (id: string) => root.querySelector(`[data-block="${id}"]`) as Element;
  return { select, at };
}

describe("the + between two blocks", () => {
  it("is offered near the edge two blocks share, in the list they're in", () => {
    const { select, at } = page();
    expect(gapAt(at("a"), { x: 10, y: 100 - EDGE / 2 }, select)).toEqual({ rootClientId: null, index: 1 });
    expect(gapAt(at("c"), { x: 10, y: 200 + EDGE / 2 }, select)).toEqual({ rootClientId: null, index: 2 });
    expect(gapAt(at("b1"), { x: 10, y: 148 }, select)).toEqual({ rootClientId: "b-slot", index: 1 });
  });

  it("goes to the list around a slot's first or last block, and isn't offered in the middle of a block", () => {
    const { select, at } = page();
    // The top of the slot's first block is the top of the middle block too: the page's own gap.
    expect(gapAt(at("b1"), { x: 10, y: 102 }, select)).toEqual({ rootClientId: null, index: 1 });
    expect(gapAt(at("a"), { x: 10, y: 50 }, select)).toBeNull();
    // Before the first block and after the last are the block list's own.
    expect(gapAt(at("a"), { x: 10, y: 2 }, select)).toBeNull();
    expect(gapAt(at("c"), { x: 10, y: 298 }, select)).toBeNull();
  });
});

describe('"/" in text', () => {
  const items = [
    { name: "goodfellow/heading", title: "Heading" },
    { name: "goodfellow/image", title: "Image", keywords: ["picture", "photo"] },
    { name: "goodfellow/gallery", title: "Gallery", keywords: ["images"] },
    { name: "goodfellow/media-text", title: "Media and text" },
    { name: "goodfellow/form", title: "Form", isDisabled: true },
  ];

  it("finds blocks by their names first, then their other words", () => {
    expect(slashMatches(items, "ima").map((item) => item.title)).toEqual(["Image", "Gallery"]);
    expect(slashMatches(items, "text").map((item) => item.title)).toEqual(["Media and text"]);
    expect(slashMatches(items, "photo").map((item) => item.title)).toEqual(["Image"]);
    expect(slashMatches(items, "").map((item) => item.title)).toEqual(["Heading", "Image", "Gallery", "Media and text"]);
  });

  it("reads the line the caret is on", () => {
    const field = document.createElement("div");
    field.contentEditable = "true";
    field.innerHTML = "<p>Words</p><p>/ima</p>";
    document.body.append(field);
    const range = document.createRange();
    range.setStart(field.lastChild?.firstChild as Text, 4);
    range.collapse(true);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    expect(caretLine(field)?.textContent).toBe("/ima");
    field.remove();
  });
});

describe("blocks' icons", () => {
  it("keep only plain shapes and the numbers that place them", () => {
    expect(
      iconShapes([
        ["path", { d: "M6 12h12", key: "8npq4p" }],
        ["circle", { cx: 12, cy: 12, r: 3 }],
        ["image", { href: "https://example.org/a.png" }],
        ["path", { d: "M0 0", onload: "alert(1)", style: "fill:url(#x)" }],
        ["rect", { x: "url(#a)" }],
      ]),
    ).toEqual([
      ["path", { d: "M6 12h12" }],
      ["circle", { cx: "12", cy: "12", r: "3" }],
      ["path", { d: "M0 0" }],
    ]);
    expect(iconShapes(undefined)).toBeUndefined();
    expect(iconShapes("M0 0")).toBeUndefined();
  });
});

describe("blocks' icons in Gutenberg", () => {
  it("are drawn as lines, which Gutenberg's lists don't fill", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { blockIcon } = await import("../src/icons.js");
    const html = renderToStaticMarkup(blockIcon([["rect", { width: "18", height: "18", x: "3", y: "3" }]]));
    expect(html).toContain('style="fill:none"');
    expect(html).toMatch(/<rect [^>]*fill="none"/);
  });
});
