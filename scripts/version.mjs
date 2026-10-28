// `pnpm release:version`: `changeset version` raises `package.json`'s version and writes CHANGELOG.md, and this puts the
// same version in `src/index.ts`'s `VERSION`, which the plugin's description carries and a test keeps the same.
import { readFileSync, writeFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const index = new URL("../src/index.ts", import.meta.url);
const source = readFileSync(index, "utf8");
const updated = source.replace(/^export const VERSION = "[^"]*";$/m, `export const VERSION = "${version}";`);
if (!updated.includes(`export const VERSION = "${version}";`)) throw new Error("src/index.ts has no VERSION to update.");
writeFileSync(index, updated);
console.log(`VERSION is ${version}.`);
