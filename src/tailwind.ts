/**
 * Tailwind in the plugin's frame, as Goodfellow's own editor has it: classes
 * the site's last build hasn't seen yet, such as ones just chosen in
 * Gutenberg's styling options, are compiled from the site's Tailwind source
 * (`session.styles().tailwind`) as they're used. Tailwind's own output would
 * style the whole frame, Gutenberg's controls too, so it's switched off and
 * handed to the canvas instead, which scopes it as it does the site's CSS.
 */

/** What `@tailwindcss/browser` writes, which starts with its licence. */
function isTailwindOutput(node: Node): node is HTMLStyleElement {
  return (
    node.nodeName === "STYLE" &&
    !(node as HTMLStyleElement).dataset.gf &&
    (node as HTMLStyleElement).getAttribute("type") === null &&
    (node.textContent ?? "").startsWith("/*! tailwindcss")
  );
}

/** Compiles the site's Tailwind source in `doc`, telling `onCss` what it makes each time it changes. Returns a stop. */
export function compileTailwind(doc: Document, source: string, onCss: (css: string) => void): () => void {
  const input = doc.createElement("style");
  input.type = "text/tailwindcss";
  input.dataset.gf = "tailwind";
  input.textContent = source;
  doc.head.append(input);

  const watched = new WeakSet<Node>();
  const observers: MutationObserver[] = [];
  const follow = (output: HTMLStyleElement) => {
    if (watched.has(output)) return;
    watched.add(output);
    output.media = "not all";
    const update = () => onCss(output.textContent ?? "");
    update();
    const observer = new MutationObserver(update);
    observer.observe(output, { childList: true, characterData: true, subtree: true });
    observers.push(observer);
  };
  const find = () => {
    for (const element of doc.head.querySelectorAll("style")) if (isTailwindOutput(element)) follow(element);
  };
  // Tailwind adds its element once, empty, and fills it in later, so every change to the head is looked at.
  const head = new MutationObserver(find);
  head.observe(doc.head, { childList: true, subtree: true, characterData: true });
  observers.push(head);
  // Loaded once something's to be compiled: it starts by itself, and watches the page's classes from then on.
  import("@tailwindcss/browser").then(find, () => {});
  return () => {
    for (const observer of observers) observer.disconnect();
    input.remove();
  };
}
