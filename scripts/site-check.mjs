// The plugin in a real Goodfellow site: a starter site from the
// `create-goodfellow` this repository depends on, with the plugin installed
// from its packed files, under `goodfellow dev`, in a browser. It chooses
// Gutenberg in the editor's header, checks the page is drawn as the site draws
// it, changes a heading in the sidebar, takes it back and forward with the
// header's Undo and Redo, types in the heading where it shows, makes a word of
// rich text bold, pastes HTML, publishes, and reads the changes from the
// page's file.
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

// Run directly rather than through npx, so stopping it stops the server, which would otherwise keep the port.
if (await fetch(`${base}/`).then(() => true, () => false)) throw new Error(`Something is already using port ${port}.`);
const server = spawn(process.execPath, [join(site, "node_modules/goodfellow/dist/cli.js"), "dev", "--port", String(port)], {
  cwd: site,
  stdio: "ignore",
});
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

  // Headings are the site's size, not the plugin screens' that Goodfellow 0.6.0 sets.
  const size = await frame.locator(".editor-styles-wrapper h2").first().evaluate((h) => getComputedStyle(h).fontSize);
  check(Number.parseFloat(size) >= 30, `headings are drawn at the site's size (${size})`);
  // The page's settings end with how a link to it looks when it's shared.
  await frame.locator(".gf-share-preview strong").waitFor();
  check(true, "the page's settings show how a link to it looks when shared");

  // A heading changed in the sidebar is drawn again, and counts as unpublished.
  const sidebar = frame.locator(".gf-editor-sidebar");
  const heading = frame.locator(".editor-styles-wrapper h1").first();
  await heading.click();
  await sidebar.getByLabel("Text", { exact: true }).fill("Hello from Gutenberg");
  await heading.filter({ hasText: "Hello from Gutenberg" }).waitFor();
  check(true, "a heading changed in the sidebar is drawn again");
  const undo = header.getByRole("button", { name: "Undo" });
  const redo = header.getByRole("button", { name: "Redo" });
  await undo.click();
  await heading.filter({ hasText: "Welcome to my site" }).waitFor();
  await redo.click();
  await heading.filter({ hasText: "Hello from Gutenberg" }).waitFor();
  check(true, "the header's Undo and Redo take it back and forward");

  // Typed where it shows: the heading is the element its text is edited in, and the sidebar follows.
  check((await heading.getAttribute("contenteditable")) === "plaintext-only", "the heading's text is edited where it shows");
  await heading.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("Typed in place");
  check((await sidebar.getByLabel("Text", { exact: true }).inputValue()) === "Typed in place", "text typed in place is the sidebar's too");

  // Rich text: a word made bold with the block's toolbar.
  const text = frame.locator(".editor-styles-wrapper .gf-text").first();
  await text.click();
  await text.evaluate((element) => {
    const words = element.querySelector("p")?.firstChild;
    const range = element.ownerDocument.createRange();
    range.setStart(words, 0);
    range.setEnd(words, 4);
    const selection = element.ownerDocument.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await frame.getByRole("button", { name: "Bold", exact: true }).click();
  // Browsers make bold text `<b>` as it's edited, which is kept as `<strong>`.
  await text.locator(":is(b, strong)", { hasText: "This" }).waitFor();
  check(true, "a word is made bold with the block's toolbar");

  // Pasted HTML becomes the site's blocks, after the block selected: the heading, pasted on as a block rather than
  // into its text (focused rather than clicked, since the toolbar of the block beside it can be over it).
  await heading.focus();
  await heading.evaluate((element) => {
    const data = new DataTransfer();
    data.setData("text/html", "<h2>Pasted heading</h2><p>Pasted <em>words</em>.</p>");
    data.setData("text/plain", "Pasted heading");
    const block = element.closest("[data-type]");
    block.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await frame.locator(".editor-styles-wrapper h2", { hasText: "Pasted heading" }).waitFor();
  check(true, "pasted HTML is drawn as the site's own blocks");
  await page.screenshot({ path: join(results, "edited.png") });

  await header.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByText("Published.").waitFor({ timeout: 30_000 });
  const saved = JSON.parse(readFileSync(homeFile, "utf8"));
  const original = JSON.parse(home);
  const [first] = saved.data.content;
  const types = first.props.content.map((block) => block.type);
  check(JSON.stringify(types) === JSON.stringify(["Heading", "Heading", "Text", "Text", "Flex"]), "the pasted blocks were published after the one selected");
  check(first.props.content[1].props.text === "Pasted heading", "the pasted heading's text was published");
  check(first.props.content[0].props.text === "Typed in place", "the text typed in place was published");
  check(first.props.content[3].props.content.startsWith("<p><strong>This</strong> page"), "the bold word was published");
  // Without what was changed, the page is as it was.
  first.props.content.splice(1, 2);
  first.props.content[0].props.text = "Welcome to my site";
  first.props.content[1].props.content = original.data.content[0].props.content[1].props.content;
  check(JSON.stringify(saved) === JSON.stringify(original), "Publish saved those changes, and nothing else");
} finally {
  writeFileSync(homeFile, home);
  await browser.close();
  server.kill();
}
