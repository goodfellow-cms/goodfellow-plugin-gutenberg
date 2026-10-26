/**
 * Checks the prototype in a browser: the starter's home page in Gutenberg,
 * with the blocks in Columns' slot side by side as on the site, each block
 * selectable, the page's data coming back as it went in, and a change to a
 * block drawn again; then the same page with blocks drawn from their fields
 * alone. Writes screenshots to `prototype/results/`.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createServer } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
// Playwright as the computer has it, which isn't one of the repository's packages.
const { chromium } = createRequire(import.meta.url)("playwright");
const results = join(here, "results");
mkdirSync(results, { recursive: true });

const server = await createServer({ root: here, configFile: join(here, "vite.config.ts"), server: { port: 4500 } });
await server.listen();
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {},
);
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(what);
};
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  page.on("pageerror", (error) => console.log("page error:", error.message));
  await page.goto("http://localhost:4500/index.html");
  const canvas = page.frameLocator('iframe[name="editor-canvas"]');
  const columns = ["Pages", "Your design", "No hosting bills"].map((text) => canvas.getByRole("heading", { name: text, level: 3 }));
  await columns[2].waitFor({ timeout: 60_000 });
  // The canvas resizes to what it holds once everything is drawn.
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(results, "home.png"), fullPage: true });

  // The Sections in Columns' slot sit side by side, as on the site.
  const boxes = await Promise.all(columns.map((heading) => heading.boundingBox()));
  check(
    boxes.every((box) => box && Math.abs(box.y - boxes[0].y) < 4) && boxes[0].x < boxes[1].x && boxes[1].x < boxes[2].x,
    `the three columns are side by side: ${boxes.map((box) => box && `${Math.round(box.x)},${Math.round(box.y)}`).join(" ")}`,
  );
  // The hero's buttons, in a Row inside a Section, sit side by side too.
  const buttons = await Promise.all(
    ["About us", "Contact"].map((name) => canvas.getByRole("link", { name }).boundingBox()),
  );
  check(buttons[0] && buttons[1] && Math.abs(buttons[0].y - buttons[1].y) < 4 && buttons[0].x < buttons[1].x, "the hero's buttons are side by side");

  // A block inside a slot inside a slot is Gutenberg's to select.
  await columns[1].click();
  const selectedName = await canvas.locator(".is-selected").first().getAttribute("data-type");
  check(selectedName === "goodfellow/heading", `clicking a heading in a column selects it (${selectedName})`);
  check(await page.getByRole("region", { name: /settings/i }).or(page.locator(".block-editor-block-inspector")).first().isVisible(), "the inspector shows the selected block");

  // Nothing is changed by opening the page in Gutenberg.
  await page.evaluate(() => {
    // Keys in order, since slots come back after a block's other props.
    const sorted = (value) =>
      Array.isArray(value)
        ? value.map(sorted)
        : value && typeof value === "object"
          ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]))
          : value;
    // The first place they differ, if they do.
    const differ = (a, b, path) => {
      if (JSON.stringify(sorted(a)) === JSON.stringify(sorted(b))) return null;
      if (a && b && typeof a === "object" && typeof b === "object") {
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
          const found = differ(a[key], b[key], `${path}.${key}`);
          if (found) return found;
        }
      }
      return `${path}: ${JSON.stringify(a)?.slice(0, 120)} where it was ${JSON.stringify(b)?.slice(0, 120)}`;
    };
    window.differ = differ;
  });
  const same = await page.evaluate(() => window.differ(window.prototype.data(), window.prototype.original, "content"));
  check(same === null, `the page's data comes back exactly as it went in${same ? ` (${same})` : ""}`);

  // A change in the sidebar's fields is drawn again by the site's renderer, and is the only change.
  const text = page.locator(".block-editor-block-inspector").getByLabel("Text", { exact: true });
  await text.fill("Your own design");
  await canvas.getByRole("heading", { name: "Your own design", level: 3 }).waitFor({ timeout: 20_000 });
  check(true, "a heading changed in the sidebar is drawn again");
  const changed = await page.evaluate(() => {
    const expected = structuredClone(window.prototype.original);
    const visit = (blocks) => {
      for (const block of blocks) {
        if (block.type === "Heading" && block.props.text === "Your design") block.props.text = "Your own design";
        for (const value of Object.values(block.props)) if (Array.isArray(value)) visit(value);
      }
    };
    visit(expected);
    return window.differ(window.prototype.data(), expected, "content");
  });
  check(changed === null, `only the heading's text changed${changed ? ` (${changed})` : ""}`);

  // Drawn from their fields alone, blocks need nothing of the site's, but slots lose their layout.
  const outline = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  outline.on("pageerror", (error) => console.log("page error:", error.message));
  await outline.goto("http://localhost:4500/index.html?draw=fields");
  const outlined = outline.frameLocator('iframe[name="editor-canvas"]');
  const words = ["Pages", "Your design", "No hosting bills"].map((text) =>
    outlined.locator(".gf-outline-words", { hasText: new RegExp(`^${text}$`) }),
  );
  await words[2].waitFor({ timeout: 60_000 });
  await outline.waitForTimeout(1000);
  await outline.screenshot({ path: join(results, "home-fields.png"), fullPage: true });
  const stacked = await Promise.all(words.map((word) => word.boundingBox()));
  check(
    stacked.every((box) => box && Math.abs(box.x - stacked[0].x) < 4) && stacked[0].y < stacked[1].y && stacked[1].y < stacked[2].y,
    "drawn from their fields alone, the columns are one under another",
  );
  await words[1].click();
  const outlinedName = await outlined.locator(".is-selected").first().getAttribute("data-type");
  check(outlinedName === "goodfellow/heading", `drawn from their fields alone, a heading is still selectable (${outlinedName})`);
} finally {
  await browser.close();
  await server.close();
}
if (failures.length > 0) {
  console.log(`${failures.length} failed`);
  process.exit(1);
}
