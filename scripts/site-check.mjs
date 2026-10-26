// The plugin in a real Goodfellow site: a starter site from the
// `create-goodfellow` this repository depends on, with the plugin installed
// from its packed files, under `goodfellow dev`, in a browser. It chooses
// Gutenberg in the editor's header, checks the page is drawn as the site draws
// it, changes a heading in the sidebar, takes it back and forward with the
// header's Undo and Redo, publishes, and reads the change from the page's file.
//
//   pnpm build && node scripts/site-check.mjs
//
// The site is made in `.site/` the first time, which needs npm to reach the
// registry; delete it to start again. Screenshots go to `.site-check/`. Set
// PLAYWRIGHT_CHROMIUM_EXECUTABLE to use a Chromium that's already installed.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = new URL("..", import.meta.url).pathname;
const site = join(root, ".site");
const results = join(root, ".site-check");
const port = 4610;
const base = `http://localhost:${port}`;
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

function check(ok, what) {
  if (!ok) throw new Error(`Failed: ${what}`);
  console.log(`ok: ${what}`);
}

// The site, made once, with the plugin in its config.
if (!existsSync(join(site, "package.json"))) {
  run(process.execPath, [require.resolve("create-goodfellow/dist/cli.js"), site, "-y", "--no-git", "--no-install", "--blocks", "built-in"]);
  const config = join(site, "goodfellow.config.tsx");
  const text = readFileSync(config, "utf8")
    .replace(
      'import { installedPlugins } from "./plugins/installed";',
      'import { installedPlugins } from "./plugins/installed";\nimport gutenberg from "goodfellow-plugin-gutenberg";',
    )
    .replace("  plugins: installedPlugins,", "  plugins: [...installedPlugins, gutenberg],");
  if (!text.includes("gutenberg]")) throw new Error("The starter's config has changed: add the plugin to it by hand.");
  writeFileSync(config, text);
  run(npm, ["install", "--no-audit", "--no-fund"], site);
}

// The plugin as npm would install it: its packed files, after the last build.
rmSync(results, { recursive: true, force: true });
mkdirSync(results, { recursive: true });
const [packed] = JSON.parse(execFileSync(npm, ["pack", "--json", "--pack-destination", results], { cwd: root, encoding: "utf8" }));
run(npm, ["install", "--no-audit", "--no-fund", "--no-save", join(results, packed.filename)], site);
// Start each run from the starter's home page as it came.
const homeFile = join(site, "content/pages/index.json");
const home = readFileSync(homeFile, "utf8");

const server = spawn(npx, ["goodfellow", "dev", "--port", String(port)], { cwd: site, stdio: "ignore" });
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {},
);
try {
  for (let tries = 0; ; tries += 1) {
    const ready = await fetch(`${base}/admin/`).then((response) => response.ok, () => false);
    if (ready) break;
    if (tries > 90) throw new Error("goodfellow dev didn't start.");
    await new Promise((done) => setTimeout(done, 1000));
  }

  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  page.on("pageerror", (error) => console.log("page error:", error.message));
  await page.goto(`${base}/admin#/pages/edit?path=%2F`);
  const header = page.locator(".gfa-editor-header");
  const choice = header.getByLabel("Editor");
  await choice.waitFor({ timeout: 90_000 });
  await choice.selectOption({ label: "Gutenberg" });
  const frame = page.frameLocator("iframe.gfa-editor-frame");
  check((await page.locator("iframe.gfa-editor-frame").getAttribute("sandbox")) === "allow-scripts", "the editor runs in a frame sandboxed with scripts only");

  // Drawn by the site's own code, with its styles: the hero has the theme's primary color.
  const hero = frame.locator(".editor-styles-wrapper section.bg-primary").first();
  await hero.waitFor({ timeout: 90_000 });
  await frame.locator(".editor-styles-wrapper").evaluate(
    (wrapper) =>
      new Promise((done) => {
        const styled = () => getComputedStyle(wrapper.querySelector("section.bg-primary")).backgroundColor !== "rgba(0, 0, 0, 0)";
        const wait = () => (styled() ? done() : setTimeout(wait, 100));
        wait();
      }),
  );
  check(true, "the page is drawn as the site draws it, with the site's styles");
  check((await frame.locator("[data-type='goodfellow/grid'] [data-type='goodfellow/section']").count()) === 3, "the Grid's three sections are blocks of their own, inside it");
  const width = await frame.locator(".gf-editor").evaluate((element) => element.getBoundingClientRect().width);
  check(width > 1400, "the editor fills its frame");
  await page.screenshot({ path: join(results, "opened.png") });

  // A heading changed in the sidebar is drawn again, and counts as unpublished.
  await frame.locator("[data-type='goodfellow/heading']").first().click();
  await frame.getByLabel("Text", { exact: true }).fill("Hello from Gutenberg");
  const heading = frame.locator(".editor-styles-wrapper h1").first();
  await heading.filter({ hasText: "Hello from Gutenberg" }).waitFor();
  check(true, "a heading changed in the sidebar is drawn again");
  const undo = header.getByRole("button", { name: "Undo" });
  const redo = header.getByRole("button", { name: "Redo" });
  await undo.click();
  await heading.filter({ hasText: "Welcome to my site" }).waitFor();
  await redo.click();
  await heading.filter({ hasText: "Hello from Gutenberg" }).waitFor();
  check(true, "the header's Undo and Redo take it back and forward");
  await page.screenshot({ path: join(results, "edited.png") });

  await header.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByText("Published.").waitFor({ timeout: 30_000 });
  const saved = JSON.parse(readFileSync(homeFile, "utf8"));
  const original = JSON.parse(home);
  const changed = JSON.stringify(saved).replace("Hello from Gutenberg", "Welcome to my site");
  check(changed === JSON.stringify(original), "Publish saved the change, and nothing else");
} finally {
  writeFileSync(homeFile, home);
  await browser.close();
  server.kill();
}
