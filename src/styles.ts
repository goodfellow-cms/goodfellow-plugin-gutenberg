/**
 * Gutenberg's styling options (colors, font size, spacing and rounded corners,
 * and the screens its Hide option hides a block on) kept as Tailwind classes in a block's `className`, which every block has, so
 * content needs nowhere new to keep them and Puck's editors see the same
 * classes: the theme's colors as `text-primary` and `bg-muted`, Tailwind's
 * scales for sizes and spacing, and values of an editor's own as arbitrary
 * classes such as `p-[13px]`. Classes Gutenberg doesn't write stay as they are.
 */
import { DEFAULT_THEME_COLORS, THEME_COLORS, type ThemeColor } from "@goodfellow-cms/core";

/** The attributes Gutenberg's block supports keep styling options in. */
export interface StyleAttributes {
  textColor?: string;
  backgroundColor?: string;
  fontSize?: string;
  style?: {
    color?: { text?: string; background?: string };
    typography?: { fontSize?: string };
    spacing?: { padding?: Sides; margin?: Sides };
    border?: { radius?: string | Corners };
  };
  /** Gutenberg keeps what its Hide option chose here: `false` everywhere, or by screen size. */
  metadata?: { blockVisibility?: BlockVisibility; [key: string]: unknown };
}

/** Gutenberg's sizes of screen, which are Puck's Hide on phones, tablets and computers. */
export type Viewport = "mobile" | "tablet" | "desktop";

/** What Gutenberg's Hide option chose: hidden everywhere, or `false` for each size of screen it's hidden on. */
export type BlockVisibility = boolean | { viewport?: Partial<Record<Viewport, boolean>> };

type Side = "top" | "right" | "bottom" | "left";
type Sides = Partial<Record<Side, string>>;
type Corner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
type Corners = Partial<Record<Corner, string>>;

/** What the admin panel's Theme tab calls each of the theme's colors. */
const COLOR_NAMES: Record<ThemeColor, string> = {
  background: "Background",
  foreground: "Text",
  primary: "Main color",
  primaryForeground: "Text on main color",
  secondary: "Second color",
  secondaryForeground: "Text on second color",
  muted: "Subtle background",
  mutedForeground: "Subtle text",
  accent: "Highlight",
  accentForeground: "Text on highlight",
  border: "Borders",
};

/** A theme color's name in classes: `primaryForeground` is `primary-foreground`. */
function colorSlug(color: ThemeColor): string {
  return color.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

const COLOR_SLUGS = new Set(THEME_COLORS.map(colorSlug));

/** Tailwind's font sizes, as Gutenberg's font size picker offers them. */
export const FONT_SIZES = [
  { slug: "xs", name: "Extra small", size: "0.75rem" },
  { slug: "sm", name: "Small", size: "0.875rem" },
  { slug: "base", name: "Normal", size: "1rem" },
  { slug: "lg", name: "Large", size: "1.125rem" },
  { slug: "xl", name: "Extra large", size: "1.25rem" },
  { slug: "2xl", name: "Very large", size: "1.5rem" },
  { slug: "3xl", name: "Huge", size: "1.875rem" },
  { slug: "4xl", name: "Very huge", size: "2.25rem" },
  { slug: "5xl", name: "Giant", size: "3rem" },
] as const;

const SIZE_SLUGS = new Set<string>(FONT_SIZES.map((size) => size.slug));

/** Tailwind's spacing scale, as Gutenberg's spacing controls offer it: each step a quarter of a rem. */
export const SPACING_SIZES = ["0", "1", "2", "3", "4", "6", "8", "12", "16"].map((slug) => ({
  slug,
  name: slug,
  size: `${Number(slug) * 0.25}rem`,
}));

/** Tailwind's numeric spacing, which every number on its scale is, halves included. */
const SPACING_STEP = /^\d+(\.5)?$/;

/** The theme's rounded corners, as Gutenberg's radius control offers them. */
export const RADIUS_SIZES = [
  { slug: "sm", name: "Small", size: "0.375rem" },
  { slug: "md", name: "Medium", size: "0.5rem" },
  { slug: "lg", name: "Large", size: "0.625rem" },
  { slug: "xl", name: "Extra large", size: "1rem" },
  { slug: "full", name: "Round", size: "9999px" },
];

const RADIUS_SLUGS = new Set(RADIUS_SIZES.map((size) => size.slug));

/** The theme's colors for Gutenberg's color controls, from the site's settings, or the defaults. */
export function colorPalette(colors: Partial<Record<ThemeColor, string>> | undefined) {
  return THEME_COLORS.map((color) => ({
    slug: colorSlug(color),
    name: COLOR_NAMES[color],
    color: colors?.[color] ?? DEFAULT_THEME_COLORS[color],
  }));
}

/**
 * The editor settings Gutenberg's styling options read (its theme.json
 * features), with the site's theme as their presets.
 */
export function styleFeatures(colors: Partial<Record<ThemeColor, string>> | undefined) {
  return {
    color: {
      palette: { theme: colorPalette(colors) },
      defaultPalette: false,
      defaultGradients: false,
      gradients: { theme: [] },
      customGradient: false,
      custom: true,
      text: true,
      background: true,
      link: false,
    },
    typography: {
      fontSizes: { theme: FONT_SIZES.map((size) => ({ ...size })) },
      defaultFontSizes: false,
      customFontSize: true,
    },
    spacing: {
      padding: true,
      margin: true,
      units: ["px", "rem", "em", "%"],
      spacingSizes: { theme: SPACING_SIZES },
      defaultSpacingSizes: false,
    },
    border: { radius: true, radiusSizes: { theme: RADIUS_SIZES }, color: false, style: false, width: false },
    // Gutenberg's Hide option with Tailwind's breakpoints, as the hide classes use them: phones are narrower
    // than `sm` (640px), tablets narrower than `lg` (1024px).
    viewport: VIEWPORT_BREAKPOINTS,
  };
}

/** Gutenberg's sizes of screen, by the widest of each: `width <= 639.98px` is narrower than Tailwind's `sm`. */
export const VIEWPORT_BREAKPOINTS = { mobile: "639.98px", tablet: "1023.98px" };

/**
 * The classes that hide a block on sizes of screen, as Goodfellow's Style
 * setting writes them (core's `block-style.ts`), the ones covering two sizes
 * first, so the fewest are written. Never plain `hidden`, which blocks use with
 * `dark:block`.
 */
const HIDDEN_CLASSES: [string, Viewport[]][] = [
  ["max-lg:hidden", ["mobile", "tablet"]],
  ["sm:hidden", ["tablet", "desktop"]],
  ["max-sm:hidden", ["mobile"]],
  ["sm:max-lg:hidden", ["tablet"]],
  ["lg:hidden", ["desktop"]],
];

const HIDDEN_BY_CLASS = new Map(HIDDEN_CLASSES);

const VIEWPORTS: Viewport[] = ["mobile", "tablet", "desktop"];

/** The sizes of screen a block is hidden on, whichever way Gutenberg wrote it. */
export function hiddenViewports(visibility: BlockVisibility | undefined): Viewport[] {
  if (visibility === false) return [...VIEWPORTS];
  if (!visibility || typeof visibility !== "object") return [];
  return VIEWPORTS.filter((viewport) => visibility.viewport?.[viewport] === false);
}

/** The fewest hide classes for sizes of screen, in the order the table has them. */
function hiddenClasses(hidden: readonly Viewport[]): string[] {
  const left = new Set(hidden);
  const classes: string[] = [];
  for (const [name, viewports] of HIDDEN_CLASSES) {
    if (viewports.every((viewport) => left.has(viewport))) {
      classes.push(name);
      for (const viewport of viewports) left.delete(viewport);
    }
  }
  return classes;
}

/** Whether a class is one of the hide classes. */
export function isHiddenClass(token: string): boolean {
  return HIDDEN_BY_CLASS.has(token);
}

/** The block supports that turn Gutenberg's styling options on, each shown in the Styles tab from the start. */
export const STYLE_SUPPORTS = {
  color: {
    text: true,
    background: true,
    link: false,
    gradients: false,
    __experimentalDefaultControls: { text: true, background: true },
  },
  typography: { fontSize: true, __experimentalDefaultControls: { fontSize: true } },
  spacing: { padding: true, margin: true, __experimentalDefaultControls: { padding: true } },
  __experimentalBorder: { radius: true, __experimentalDefaultControls: { radius: true } },
};

/** An arbitrary value as Tailwind writes it, with spaces as underscores: `[13px]`. */
function arbitrary(value: string): string {
  return `[${value.trim().replace(/\s+/g, "_")}]`;
}

/** An arbitrary value back from a class, or `undefined` for one that isn't. */
function fromArbitrary(value: string): string | undefined {
  const match = /^\[(.+)\]$/.exec(value);
  return match?.[1]?.replace(/_/g, " ");
}

/** Whether an arbitrary value is a color rather than a length. */
function isColor(value: string): boolean {
  return /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(.*\))$/i.test(value.trim());
}

/** Whether a value is safe in a class: no characters that end one or break Tailwind's brackets. */
function isSafeValue(value: string): boolean {
  return /^[#a-zA-Z0-9(),.%\s/+*-]{1,60}$/.test(value);
}

/** A spacing value as a class's value: `var:preset|spacing|4` is `4`, `13px` is `[13px]`. */
function spacingValue(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return undefined;
  const preset = /^var:preset\|spacing\|(.+)$/.exec(value)?.[1];
  if (preset !== undefined) return SPACING_STEP.test(preset) ? preset : undefined;
  if (value === "0") return "0";
  // A length on Tailwind's scale is its step, as Tailwind writes it.
  const rem = /^(\d+(?:\.\d+)?)rem$/.exec(value)?.[1];
  if (rem !== undefined && SPACING_STEP.test(String(Number(rem) * 4))) return String(Number(rem) * 4);
  return isSafeValue(value) ? arbitrary(value) : undefined;
}

/** A class's spacing value as Gutenberg's: a step on the scale is a preset, anything else as written. */
function spacingAttribute(value: string): string | undefined {
  if (SPACING_STEP.test(value)) return SPACING_SIZES.some((size) => size.slug === value) ? `var:preset|spacing|${value}` : `${Number(value) * 0.25}rem`;
  return fromArbitrary(value);
}

const SIDE_PREFIXES: Record<string, Side[]> = {
  "": ["top", "right", "bottom", "left"],
  x: ["left", "right"],
  y: ["top", "bottom"],
  t: ["top"],
  r: ["right"],
  b: ["bottom"],
  l: ["left"],
};

/** Sides as the fewest classes: `p-4`, or `px-4 py-2`, or a class for each side. */
function sideClasses(prefix: "p" | "m", sides: Sides | undefined): string[] {
  if (!sides) return [];
  const value = (side: Side) => spacingValue(sides[side]);
  const [top, right, bottom, left] = [value("top"), value("right"), value("bottom"), value("left")];
  if (top !== undefined && top === right && top === bottom && top === left) return [`${prefix}-${top}`];
  const classes: string[] = [];
  if (left !== undefined && left === right) classes.push(`${prefix}x-${left}`);
  else {
    if (right !== undefined) classes.push(`${prefix}r-${right}`);
    if (left !== undefined) classes.push(`${prefix}l-${left}`);
  }
  if (top !== undefined && top === bottom) classes.push(`${prefix}y-${top}`);
  else {
    if (top !== undefined) classes.push(`${prefix}t-${top}`);
    if (bottom !== undefined) classes.push(`${prefix}b-${bottom}`);
  }
  return classes;
}

/** A radius as a class's value: a preset is its name, anything else as written. */
function radiusValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const preset = /^var:preset\|border-radius\|(.+)$/.exec(value)?.[1];
  if (preset !== undefined) return RADIUS_SLUGS.has(preset) ? preset : undefined;
  return isSafeValue(value) ? arbitrary(value) : undefined;
}

const CORNER_PREFIXES: Record<Corner, string> = {
  topLeft: "tl",
  topRight: "tr",
  bottomLeft: "bl",
  bottomRight: "br",
};

function radiusClasses(radius: string | Corners | undefined): string[] {
  if (radius === undefined) return [];
  if (typeof radius === "string") {
    const value = radiusValue(radius);
    return value ? [`rounded-${value}`] : [];
  }
  const values = (Object.keys(CORNER_PREFIXES) as Corner[]).map((corner) => radiusValue(radius[corner]));
  if (values[0] !== undefined && values.every((value) => value === values[0])) return [`rounded-${values[0]}`];
  return (Object.keys(CORNER_PREFIXES) as Corner[]).flatMap((corner, index) =>
    values[index] ? [`rounded-${CORNER_PREFIXES[corner]}-${values[index]}`] : [],
  );
}

/** The classes for what's chosen in Gutenberg's styling options. */
export function classesFromStyles(attributes: StyleAttributes): string[] {
  const { style } = attributes;
  const classes: string[] = [];
  if (attributes.textColor && COLOR_SLUGS.has(attributes.textColor)) classes.push(`text-${attributes.textColor}`);
  else if (style?.color?.text && isColor(style.color.text)) classes.push(`text-${arbitrary(style.color.text)}`);
  if (attributes.backgroundColor && COLOR_SLUGS.has(attributes.backgroundColor)) {
    classes.push(`bg-${attributes.backgroundColor}`);
  } else if (style?.color?.background && isColor(style.color.background)) {
    classes.push(`bg-${arbitrary(style.color.background)}`);
  }
  if (attributes.fontSize && SIZE_SLUGS.has(attributes.fontSize)) classes.push(`text-${attributes.fontSize}`);
  else if (style?.typography?.fontSize && isSafeValue(style.typography.fontSize)) {
    classes.push(`text-${arbitrary(style.typography.fontSize)}`);
  }
  classes.push(...sideClasses("p", style?.spacing?.padding), ...sideClasses("m", style?.spacing?.margin));
  classes.push(...radiusClasses(style?.border?.radius));
  classes.push(...hiddenClasses(hiddenViewports(attributes.metadata?.blockVisibility)));
  return classes;
}

/** Sets a value deep in the attributes' `style`, making each level on the way. */
function setStyle(attributes: StyleAttributes, path: string[], value: string) {
  let at = (attributes.style ??= {}) as Record<string, unknown>;
  for (const key of path.slice(0, -1)) at = (at[key] ??= {}) as Record<string, unknown>;
  at[path.at(-1) as string] = value;
}

/** One class read as a styling option, if it's one Gutenberg writes. Answers whether it was. */
function readClass(token: string, attributes: StyleAttributes): boolean {
  const color = /^(text|bg)-(.+)$/.exec(token);
  if (color) {
    const [, kind, value] = color as unknown as [string, "text" | "bg", string];
    if (COLOR_SLUGS.has(value)) {
      if (kind === "text") attributes.textColor = value;
      else attributes.backgroundColor = value;
      return true;
    }
    if (kind === "text" && SIZE_SLUGS.has(value)) {
      attributes.fontSize = value;
      return true;
    }
    const custom = fromArbitrary(value);
    if (custom !== undefined && isColor(custom)) {
      setStyle(attributes, ["color", kind === "text" ? "text" : "background"], custom);
      return true;
    }
    if (custom !== undefined && kind === "text" && /^[\d.]+(px|rem|em|%)$/.test(custom)) {
      setStyle(attributes, ["typography", "fontSize"], custom);
      return true;
    }
    return false;
  }
  const spacing = /^([pm])([xytrbl]?)-(.+)$/.exec(token);
  if (spacing) {
    const [, kind, sides, raw] = spacing as unknown as [string, "p" | "m", string, string];
    const value = spacingAttribute(raw);
    if (value === undefined) return false;
    for (const side of SIDE_PREFIXES[sides] ?? []) {
      setStyle(attributes, ["spacing", kind === "p" ? "padding" : "margin", side], value);
    }
    return true;
  }
  const radius = /^rounded(?:-(tl|tr|bl|br))?-(.+)$/.exec(token);
  if (radius) {
    const [, corner, raw] = radius as unknown as [string, string | undefined, string];
    const value = RADIUS_SLUGS.has(raw) ? `var:preset|border-radius|${raw}` : fromArbitrary(raw);
    if (value === undefined) return false;
    const corners = Object.entries(CORNER_PREFIXES).filter(([, prefix]) => !corner || prefix === corner);
    const border = ((attributes.style ??= {}).border ??= {});
    if (!corner) {
      border.radius = value;
      return true;
    }
    const current = typeof border.radius === "string" ? undefined : border.radius;
    border.radius = { ...current, ...Object.fromEntries(corners.map(([name]) => [name, value])) };
    return true;
  }
  return false;
}

/**
 * A block's classes as Gutenberg's styling options and the classes that
 * aren't one, which stay as they are. A class for something already read
 * (a second text color, say) is kept as it is too.
 */
export function stylesFromClasses(className: string): { attributes: StyleAttributes; rest: string[] } {
  const attributes: StyleAttributes = {};
  const rest: string[] = [];
  const seen = new Set<string>();
  const hidden = new Set<Viewport>();
  for (const token of className.split(/\s+/).filter(Boolean)) {
    const hides = HIDDEN_BY_CLASS.get(token);
    if (hides) {
      for (const viewport of hides) hidden.add(viewport);
      continue;
    }
    // Variants (`md:p-4`, `hover:bg-muted`) and `!important` are the site's own, kept as written.
    const kind = token.includes(":") || token.startsWith("!") ? undefined : classKind(token);
    if (!kind || seen.has(kind) || !readClass(token, attributes)) {
      rest.push(token);
      continue;
    }
    seen.add(kind);
  }
  if (hidden.size > 0) {
    attributes.metadata = {
      blockVisibility: { viewport: Object.fromEntries(VIEWPORTS.filter((v) => hidden.has(v)).map((v) => [v, false])) },
    };
  }
  return { attributes, rest };
}

/** What a class sets, so a second class for the same thing is left as it is. */
function classKind(token: string): string | undefined {
  if (/^text-/.test(token)) {
    const value = token.slice(5);
    const custom = fromArbitrary(value);
    return SIZE_SLUGS.has(value) || (custom !== undefined && !isColor(custom)) ? "font-size" : "text-color";
  }
  if (/^bg-/.test(token)) return "background";
  const spacing = /^([pm])([xytrbl]?)-/.exec(token);
  if (spacing) return `${spacing[1]}${spacing[2]}`;
  const radius = /^rounded(?:-(tl|tr|bl|br))?-/.exec(token);
  if (radius) return `rounded${radius[1] ?? ""}`;
  return undefined;
}

/** Whether two sets of styling options are the same, whatever order their keys are in. */
export function sameStyles(a: StyleAttributes, b: StyleAttributes): boolean {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, inner]) => inner !== undefined && !(inner && typeof inner === "object" && Object.keys(inner).length === 0))
          .sort(([x], [y]) => x.localeCompare(y))
          .map(([key, inner]) => [key, canonical(inner)]),
      );
    }
    return value;
  };
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/**
 * Just the styling options from a block's attributes, as Gutenberg keeps them,
 * with what its Hide option chose as the sizes of screen it hides the block on,
 * as the hide classes read back, and none of the rest of its `metadata`.
 */
export function styleAttributes(attributes: Record<string, unknown>): StyleAttributes {
  const { textColor, backgroundColor, fontSize, style, metadata } = attributes as StyleAttributes;
  const hidden = hiddenViewports(metadata?.blockVisibility);
  return {
    ...(textColor && { textColor }),
    ...(backgroundColor && { backgroundColor }),
    ...(fontSize && { fontSize }),
    ...(style && { style }),
    ...(hidden.length > 0 && {
      metadata: { blockVisibility: { viewport: Object.fromEntries(hidden.map((viewport) => [viewport, false])) } },
    }),
  };
}

/**
 * The block's `className` for what's chosen in Gutenberg: as it was where
 * nothing changed, so a page opened and published changes nothing, or else
 * the other classes in their order, then the styling options' classes.
 */
export function classNameFor(original: string, styles: StyleAttributes, extra: string | undefined): string {
  const before = stylesFromClasses(original);
  const chosen = styleAttributes(styles as Record<string, unknown>);
  const extraClasses = (extra ?? "").split(/\s+/).filter(Boolean);
  if (sameStyles(before.attributes, chosen) && extraClasses.join(" ") === before.rest.join(" ")) return original;
  return [...extraClasses, ...classesFromStyles(chosen)].join(" ");
}
