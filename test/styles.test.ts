/** Gutenberg's styling options as Tailwind classes in a block's `className`, and back. */
import { describe, expect, it } from "vitest";
import { withoutHiddenClasses, withStyleClasses } from "../src/convert.js";
import { classesFromStyles, classNameFor, colorPalette, styleFeatures, stylesFromClasses } from "../src/styles.js";

describe("styling options as classes", () => {
  it("writes the theme's colors, Tailwind's sizes and spacing, and rounded corners", () => {
    expect(
      classesFromStyles({
        textColor: "primary-foreground",
        backgroundColor: "primary",
        fontSize: "2xl",
        style: {
          spacing: {
            padding: { top: "var:preset|spacing|4", right: "var:preset|spacing|4", bottom: "var:preset|spacing|4", left: "var:preset|spacing|4" },
            margin: { top: "var:preset|spacing|8", bottom: "var:preset|spacing|8" },
          },
          border: { radius: "var:preset|border-radius|lg" },
        },
      }),
    ).toEqual(["text-primary-foreground", "bg-primary", "text-2xl", "p-4", "my-8", "rounded-lg"]);
  });

  it("writes values of an editor's own as arbitrary classes, and steps of the scale as steps", () => {
    expect(
      classesFromStyles({
        style: {
          color: { text: "#ab1234", background: "rgb(1 2 3)" },
          typography: { fontSize: "13px" },
          spacing: { padding: { left: "13px", right: "13px", top: "1.25rem" } },
          border: { radius: { topLeft: "4px", bottomRight: "4px" } },
        },
      }),
    ).toEqual(["text-[#ab1234]", "bg-[rgb(1_2_3)]", "text-[13px]", "px-[13px]", "pt-5", "rounded-tl-[4px]", "rounded-br-[4px]"]);
  });

  it("reads them back from classes, leaving the rest as they are", () => {
    const { attributes, rest } = stylesFromClasses("mt-6 text-primary shadow md:p-8 bg-[#fff] text-lg custom rounded-full");
    expect(attributes).toEqual({
      textColor: "primary",
      fontSize: "lg",
      style: {
        spacing: { margin: { top: "var:preset|spacing|6" } },
        color: { background: "#fff" },
        border: { radius: "var:preset|border-radius|full" },
      },
    });
    expect(rest).toEqual(["shadow", "md:p-8", "custom"]);
  });

  it("keeps a second class for the same thing as one of the block's own", () => {
    const { attributes, rest } = stylesFromClasses("text-primary text-muted-foreground");
    expect(attributes).toEqual({ textColor: "primary" });
    expect(rest).toEqual(["text-muted-foreground"]);
  });

  it("refuses values that could break out of a class", () => {
    expect(classesFromStyles({ style: { typography: { fontSize: "1px] bg-[red" } } })).toEqual([]);
    expect(classesFromStyles({ style: { color: { text: "url(x)" } } })).toEqual([]);
  });

  it("leaves a block's classes as they were where nothing changed", () => {
    const original = "rounded-full   custom mt-6";
    const { attributes, rest } = stylesFromClasses(original);
    expect(classNameFor(original, attributes, rest.join(" "))).toBe(original);
    expect(classNameFor(original, { ...attributes, backgroundColor: "muted" }, rest.join(" "))).toBe(
      "custom bg-muted mt-6 rounded-full",
    );
    expect(classNameFor("", {}, undefined)).toBe("");
  });

  it("draws a block with what's chosen as the classes it's published as", () => {
    const props = { text: "Hello", className: "tracking-wide text-primary" };
    expect(withStyleClasses(props, { props, textColor: "accent", className: "tracking-wide" })).toEqual({
      text: "Hello",
      className: "tracking-wide text-accent",
    });
    // Nothing chosen and no classes: the props as they were, with no `className` added.
    const plain = { text: "Hello" };
    expect(withStyleClasses(plain, { props: plain })).toBe(plain);
  });

  it("keeps Gutenberg's Hide option as the classes Puck's Hide on writes, the fewest of them", () => {
    const hide = (viewport: Record<string, boolean>) => classesFromStyles({ metadata: { blockVisibility: { viewport } } });
    expect(hide({ mobile: false })).toEqual(["max-sm:hidden"]);
    expect(hide({ tablet: false })).toEqual(["sm:max-lg:hidden"]);
    expect(hide({ desktop: false })).toEqual(["lg:hidden"]);
    expect(hide({ mobile: false, tablet: false })).toEqual(["max-lg:hidden"]);
    expect(hide({ tablet: false, desktop: false })).toEqual(["sm:hidden"]);
    expect(hide({ mobile: false, desktop: false })).toEqual(["max-sm:hidden", "lg:hidden"]);
    expect(hide({ mobile: true, tablet: true })).toEqual([]);
    // Hidden everywhere is hidden on every size of screen, never plain `hidden`, which blocks use with `dark:block`.
    expect(classesFromStyles({ metadata: { blockVisibility: false } })).toEqual(["max-lg:hidden", "lg:hidden"]);
    expect(classesFromStyles({ metadata: { blockVisibility: true } })).toEqual([]);
  });

  it("reads the hide classes back as Gutenberg's Hide option, leaving other variants as they are", () => {
    const { attributes, rest } = stylesFromClasses("max-sm:hidden text-primary md:hidden lg:hidden hidden dark:block");
    expect(attributes).toEqual({
      textColor: "primary",
      metadata: { blockVisibility: { viewport: { mobile: false, desktop: false } } },
    });
    expect(rest).toEqual(["md:hidden", "hidden", "dark:block"]);
    // Classes covering two sizes, such as the Style setting writes for phones and tablets.
    expect(stylesFromClasses("max-lg:hidden").attributes).toEqual({
      metadata: { blockVisibility: { viewport: { mobile: false, tablet: false } } },
    });
  });

  it("leaves the classes as they were where the Hide option didn't change, whichever way Gutenberg wrote it", () => {
    const original = "max-lg:hidden lg:hidden custom";
    const { attributes, rest } = stylesFromClasses(original);
    expect(classNameFor(original, { metadata: { blockVisibility: false } }, rest.join(" "))).toBe(original);
    const props = { className: original };
    expect(
      withStyleClasses(props, { props, className: "custom", metadata: { blockVisibility: { viewport: { desktop: false } }, name: "Mine" } }),
    ).toEqual({ className: "custom lg:hidden" });
    expect(attributes.metadata).toBeDefined();
  });

  it("draws a hidden block in the editor without the classes that hide it", () => {
    expect(withoutHiddenClasses({ text: "Hi", className: "max-sm:hidden text-primary" })).toEqual({
      text: "Hi",
      className: "text-primary",
    });
    const plain = { text: "Hi", className: "md:hidden" };
    expect(withoutHiddenClasses(plain)).toBe(plain);
  });

  it("gives Gutenberg's sizes of screen Tailwind's breakpoints", () => {
    expect(styleFeatures(undefined).viewport).toEqual({ mobile: "639.98px", tablet: "1023.98px" });
  });

  it("offers the theme's colors by the Theme tab's names, with the site's values", () => {
    const palette = colorPalette({ primary: "#1e3a8a" });
    expect(palette.find((color) => color.slug === "primary")).toEqual({ slug: "primary", name: "Main color", color: "#1e3a8a" });
    expect(palette.find((color) => color.slug === "muted-foreground")?.name).toBe("Subtle text");
  });
});
