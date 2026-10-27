/** What npm publishes, as Goodfellow's Plugins screen reads it: the package, its manifest and its Goodfellow range. */
import { readFileSync } from "node:fs";
import {
  GOODFELLOW_PEER,
  GOODFELLOW_VERSION,
  inRange,
  isPluginName,
  PLUGIN_KEYWORD,
  pluginManifest,
  pluginProblems,
} from "@goodfellow-cms/core";
import { describe, expect, it } from "vitest";
import plugin, { VERSION } from "../src/index.js";

const json = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const pkg = json("../package.json");

describe("the published package", () => {
  it("is named, versioned and found as a Goodfellow plugin", () => {
    expect(isPluginName(pkg.name)).toBe(true);
    expect(plugin.name).toBe(pkg.name);
    expect(VERSION).toBe(pkg.version);
    expect(plugin.version).toBe(pkg.version);
    expect(pkg.keywords).toContain(PLUGIN_KEYWORD);
  });

  it("is a plugin Goodfellow accepts, whose manifest is the one committed", () => {
    expect(pluginProblems([plugin])).toEqual([]);
    expect(json("../goodfellow-plugin.json")).toEqual(JSON.parse(JSON.stringify(pluginManifest(plugin))));
  });

  it("works with the Goodfellow release it's tested with", () => {
    const range = pkg.peerDependencies[GOODFELLOW_PEER];
    expect(inRange(GOODFELLOW_VERSION, range)).toBe(true);
    expect(inRange("0.7.0", range)).toBe(true);
  });

  it("says where its source and license are, for the notices sites' builds write", () => {
    expect(pkg.license).toBe("GPL-2.0-or-later");
    expect(pkg.repository.url).toContain("goodfellow-cms/goodfellow-plugin-gutenberg");
    expect(pkg.files).toEqual(expect.arrayContaining(["dist", "goodfellow-plugin.json"]));
  });
});
