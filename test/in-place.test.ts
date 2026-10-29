/**
 * Text edited in place, against the starter's own blocks as Goodfellow draws
 * them: each field marked `contentEditable` comes out of the drawing as an
 * element of its own, wherever the block puts it, holding its value.
 */
import { join } from "node:path";
import type { GoodfellowConfig } from "@goodfellow-cms/core";
import { describeSite } from "@goodfellow-cms/react";
import type { ComponentData } from "@puckeditor/core";
import { describe, expect, it } from "vitest";
import { inPlaceFields, placeInPlace, readValue, withMarkers, writeValue } from "../src/in-place.js";
import { siteDir } from "../sites.js";
import { siteDrawer } from "./draw.js";

const root = siteDir("starter");
const config = ((await import(join(root, "goodfellow.config.tsx"))) as { default: GoodfellowConfig }).default;
const description = describeSite(config);
const draw = await siteDrawer(config, root);

/** A block drawn with its in-place fields as markers, then placed, as the editor does. */
async function placed(type: string, props: Record<string, unknown>) {
  const fields = inPlaceFields(description.blocks[type]?.fields ?? {});
  const full = { ...description.blocks[type]?.defaultProps, ...props, id: `${type}-1` };
  const html = await draw({ type, props: withMarkers(full, fields) } as ComponentData);
  const element = document.createElement("div");
  element.innerHTML = html;
  return { element, fields, editing: placeInPlace(element, fields, full) };
}

describe("text edited in place", () => {
  it("is the heading itself, holding its text", async () => {
    const { element, editing, fields } = await placed("Heading", { text: "Welcome", level: "h2" });
    const heading = editing.get("text");
    expect(heading?.tagName).toBe("H2");
    expect(heading?.getAttribute("contenteditable")).toBe("plaintext-only");
    expect(heading?.textContent).toBe("Welcome");
    expect(element.innerHTML).not.toMatch(/gfinplace/);
    heading && (heading.textContent = "Welcome back");
    expect(heading && fields[0] && readValue(heading, fields[0])).toBe("Welcome back");
  });

  it("is rich text's whole element, so its paragraphs and lists keep the site's styles", async () => {
    const html = "<p>One <strong>two</strong></p><ul><li>Three</li></ul>";
    const { editing } = await placed("Text", { content: html });
    const text = editing.get("content");
    expect(text?.classList.contains("gf-text")).toBe(true);
    expect(text?.getAttribute("contenteditable")).toBe("true");
    expect(text?.innerHTML).toBe(html);
  });

  it("cleans rich text as it's put in place, whoever wrote it", () => {
    const element = document.createElement("div");
    writeValue(element, { name: "content", type: "richtext", label: "Text" }, '<p>ok</p><img src=x onerror="alert(1)">');
    expect(element.innerHTML).toBe("<p>ok</p>");
  });

  it("is a button's label, inside its link", async () => {
    const { editing } = await placed("Button", { label: "Read more", href: "/about" });
    const label = editing.get("label");
    expect(label?.textContent).toBe("Read more");
    expect(label?.closest("a")?.getAttribute("href")).toBe("/about");
  });

  it("is each of a quote's two parts", async () => {
    const { editing } = await placed("Pullquote", { quote: "Line one\nLine two", citation: "Someone" });
    expect(editing.get("quote")?.textContent).toBe("Line one\nLine two");
    expect(editing.get("citation")?.textContent).toBe("Someone");
  });

  it("shows empty text as what it's for, so it can still be filled in", async () => {
    const { editing } = await placed("Heading", { text: "" });
    expect(editing.get("text")?.textContent).toBe("");
    expect(editing.get("text")?.getAttribute("data-placeholder")).toBe("Text");
  });

  it("puts the value back wherever else the block used the text, such as an attribute", () => {
    const element = document.createElement("div");
    const fields = [{ name: "text", type: "text", label: "Text" }] as const;
    const marker = (withMarkers({ text: "x" }, fields).text as string) ?? "";
    element.innerHTML = `<section aria-label="${marker}"><h2>${marker}</h2><p>About ${marker}.</p></section>`;
    const editing = placeInPlace(element, fields, { text: "Our parish" });
    expect(element.querySelector("section")?.getAttribute("aria-label")).toBe("Our parish");
    expect(editing.get("text")?.tagName).toBe("H2");
    expect(element.querySelector("p")?.textContent).toBe("About Our parish.");
  });

  it("is an element of its own among other words, and leaves out a block that changes its text", () => {
    const element = document.createElement("div");
    const fields = [
      { name: "name", type: "text", label: "Name" },
      { name: "lost", type: "text", label: "Lost" },
    ] as const;
    const drawn = withMarkers({ name: "", lost: "" }, fields);
    element.innerHTML = `<p>By ${drawn.name}, today</p><p>${String(drawn.lost).toUpperCase()}</p>`;
    const editing = placeInPlace(element, fields, { name: "Ann", lost: "x" });
    expect(editing.get("name")?.tagName).toBe("SPAN");
    expect(element.querySelector("p")?.textContent).toBe("By Ann, today");
    expect(editing.has("lost")).toBe(false);
  });

  it("is only the fields Puck edits in place too", () => {
    expect(inPlaceFields(description.blocks.Heading?.fields ?? {}).map((field) => field.name)).toEqual(["text"]);
    expect(inPlaceFields(description.blocks.Image?.fields ?? {})).toEqual([]);
  });
});
