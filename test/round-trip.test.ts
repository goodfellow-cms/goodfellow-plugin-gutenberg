/**
 * Every page, header, footer and collection template of Goodfellow's starter,
 * its parish example and its docs, from Goodfellow to Gutenberg's blocks, into
 * Gutenberg's editor store and back, must come out exactly as it went in.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { SiteDescription } from "@goodfellow-cms/core";
import type { ComponentData } from "@puckeditor/core";
import { store as blockEditorStore } from "@wordpress/block-editor";
import { dispatch, select } from "@wordpress/data";
import { describe, expect, it } from "vitest";
import { fromGutenberg, toGutenberg } from "../src/convert.js";
import { SLOT_BLOCK } from "../src/names.js";
import { registerBlocks } from "../src/register.js";

const fixtures = join(import.meta.dirname, "fixtures");

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/** Each fixture site's content with blocks: pages, the header and footer, and collections' templates. */
function contentOf(site: string): { file: string; content: ComponentData[] }[] {
  return files(join(fixtures, site, "content"))
    .filter((file) => file.endsWith(".json"))
    .flatMap((file) => {
      const json = JSON.parse(readFileSync(file, "utf8")) as {
        data?: { content?: ComponentData[] };
        template?: { content?: ComponentData[] };
      };
      const content = json.data?.content ?? json.template?.content;
      return Array.isArray(content) ? [{ file: relative(fixtures, file), content }] : [];
    });
}

const edit = () => null;

describe.each(["starter", "parish", "docs"])("the %s site", (site) => {
  const description = JSON.parse(
    readFileSync(join(fixtures, site, "goodfellow-site.json"), "utf8"),
  ) as SiteDescription;
  const names = registerBlocks(description, { edit, slotEdit: edit, templates: true });
  const pages = contentOf(site);

  it("has pages to check", () => {
    expect(pages.length).toBeGreaterThan(2);
  });

  it.each(pages.map((page) => [page.file, page.content] as const))(
    "%s goes through Gutenberg's editor unchanged",
    (_file, content) => {
      const blocks = toGutenberg(content, description, names);
      (dispatch(blockEditorStore) as { resetBlocks(blocks: unknown[]): void }).resetBlocks(blocks);
      const back = fromGutenberg(select(blockEditorStore).getBlocks(), description, names);
      expect(back).toEqual(content);
    },
  );

  it("keeps each slot of a block apart, in a slot block of its own", () => {
    const withSlots = Object.entries(description.blocks).find(
      ([, block]) => Object.values(block.fields).filter((field) => (field as { type?: string }).type === "slot").length > 0,
    );
    expect(withSlots).toBeDefined();
    const [type, block] = withSlots as [string, SiteDescription["blocks"][string]];
    const slots = Object.keys(block.fields).filter((name) => (block.fields[name] as { type?: string }).type === "slot");
    const [converted] = toGutenberg([{ type, props: { id: "a" } } as ComponentData], description, names);
    expect(converted?.innerBlocks.map((child) => [child.name, child.attributes.slot])).toEqual(
      slots.map((slot) => [SLOT_BLOCK, slot]),
    );
  });
});
