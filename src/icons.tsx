/**
 * Blocks' icons in Gutenberg, from the site's description: Goodfellow carries
 * each block's icon (`withIcon()`) as SVG shapes on a 24-unit grid. The plugin
 * reads them itself, keeping only plain shapes and the numbers that place them,
 * so an icon can't load or run anything, and so sites made before icons, which
 * have none, get WordPress's own icon for a block.
 */
import { blockDefault } from "@wordpress/icons";
import { createElement, type ReactElement } from "react";

const SHAPES = new Set(["path", "circle", "ellipse", "line", "polyline", "polygon", "rect"]);
const ATTRIBUTES = ["d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "width", "height", "points"];
const MAX_SHAPES = 32;
const MAX_VALUE = 2_000;
/** Numbers, and the letters and punctuation of path data: never `url(…)`, quotes or `<`. */
const SAFE_VALUE = /^[\d\s.,+\-eEaAcChHlLmMqQsStTvVzZ]*$/;

export type IconShapes = Array<[string, Record<string, string>]>;

/** A block's icon as the description has it, with only what icons may hold, or `undefined` where there's none. */
export function iconShapes(value: unknown): IconShapes | undefined {
  if (!Array.isArray(value)) return undefined;
  const shapes: IconShapes = [];
  for (const entry of value.slice(0, MAX_SHAPES)) {
    if (!Array.isArray(entry)) continue;
    const [name, attributes] = entry as [unknown, unknown];
    if (typeof name !== "string" || !SHAPES.has(name) || !attributes || typeof attributes !== "object") continue;
    const kept: Record<string, string> = {};
    for (const attribute of ATTRIBUTES) {
      const given = (attributes as Record<string, unknown>)[attribute];
      if (typeof given !== "string" && typeof given !== "number") continue;
      const text = String(given);
      if (text.length <= MAX_VALUE && SAFE_VALUE.test(text)) kept[attribute] = text;
    }
    if (Object.keys(kept).length > 0) shapes.push([name, kept]);
  }
  return shapes.length > 0 ? shapes : undefined;
}

/** The icon Gutenberg shows for a block: its own, drawn as lines in the text's color, or WordPress's for any block. */
export function blockIcon(value: unknown): ReactElement {
  const shapes = iconShapes(value);
  if (!shapes) return blockDefault;
  return createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      width: 24,
      height: 24,
      fill: "none",
      // Gutenberg's lists fill block icons, as WordPress's are drawn: these are lines.
      style: { fill: "none" },
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": true,
      focusable: false,
    },
    ...shapes.map(([shape, attributes], index) => createElement(shape, { key: index, ...attributes, fill: "none" })),
  );
}
