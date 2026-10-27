/**
 * Every page, header, footer and collection template of Goodfellow's starter
 * and its parish example, from Goodfellow to Gutenberg's blocks, into
 * Gutenberg's editor store and back, must come out exactly as it went in.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { GoodfellowConfig, SiteDescription } from "@goodfellow-cms/core";
import { describeSite } from "@goodfellow-cms/react";
import type { ComponentData } from "@puckeditor/core";
import { store as blockEditorStore } from "@wordpress/block-editor";
import { dispatch, select } from "@wordpress/data";
import { createBlock } from "@wordpress/blocks";
import { describe, expect, it } from "vitest";
import { fromGutenberg, toGutenberg } from "../src/convert.js";
import { onlySlot, SLOT_BLOCK, slotNames } from "../src/names.js";
import { registerBlocks } from "../src/register.js";
import { SITES, type SiteName, siteDir } from "../sites.js";

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/** A site's content with blocks: pages, the header and footer, and collections' templates. */
function contentOf(site: SiteName): { file: string; content: ComponentData[] }[] {
  const dir = siteDir(site);
  return files(join(dir, "content"))
    .filter((file) => file.endsWith(".json"))
    .flatMap((file) => {
      const json = JSON.parse(readFileSync(file, "utf8")) as {
        data?: { content?: ComponentData[] };
        template?: { content?: ComponentData[] };
      };
      const content = json.data?.content ?? json.template?.content;
      return Array.isArray(content) ? [{ file: relative(dir, file), content }] : [];
    });
}

const edit = () => null;

/** Each site's description, made from its own config as its builds make `goodfellow-site.json`. */
const descriptions = Object.fromEntries(
  await Promise.all(
    SITES.map(async (site) => {
      const config = (await import(join(siteDir(site), "goodfellow.config.tsx"))) as { default: GoodfellowConfig };
      return [site, describeSite(config.default)] as const;
    }),
  ),
) as Record<SiteName, SiteDescription>;

describe.each(SITES)("the %s site", (site) => {
  const description = descriptions[site];
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

  it("keeps each slot of a block with several apart, in a slot block of its own", () => {
    const withSlots = Object.entries(description.blocks).find(([, block]) => slotNames(block).length > 1);
    expect(withSlots).toBeDefined();
    const [type, block] = withSlots as [string, SiteDescription["blocks"][string]];
    const [converted] = toGutenberg([{ type, props: { id: "a" } } as ComponentData], description, names);
    expect(converted?.innerBlocks.map((child) => [child.name, child.attributes.slot])).toEqual(
      slotNames(block).map((slot) => [SLOT_BLOCK, slot]),
    );
  });

  it("puts the blocks of a block with one slot straight inside it, and back in its slot", () => {
    const withOne = Object.entries(description.blocks).find(([, block]) => onlySlot(block));
    expect(withOne).toBeDefined();
    const [type, block] = withOne as [string, SiteDescription["blocks"][string]];
    const slot = onlySlot(block) as string;
    const heading = { type: "Heading", props: { id: "h", text: "Inside" } } as ComponentData;
    const content = [{ type, props: { id: "a", [slot]: [heading] } } as ComponentData];
    const [converted] = toGutenberg(content, description, names);
    expect(converted?.innerBlocks.map((child) => child.name)).toEqual([names.toGutenberg("Heading")]);
    const [back] = fromGutenberg(converted ? [converted] : [], description, names);
    expect(back?.props[slot]).toEqual([heading]);
    // As copies from before kept them, in a slot block, they still come back.
    const old = createBlock(names.toGutenberg(type) as string, { props: { id: "a" } }, [
      createBlock(SLOT_BLOCK, { slot }, converted?.innerBlocks ?? []),
    ]);
    expect(fromGutenberg([old], description, names)[0]?.props[slot]).toEqual([heading]);
  });
});
