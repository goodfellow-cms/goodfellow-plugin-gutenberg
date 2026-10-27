/**
 * The plugin's admin module, which runs in its own sandboxed frame in the
 * admin panel: Gutenberg's block editor for whoever chooses it in the editor's
 * header. It never has the site's code. It knows the site's blocks by their
 * fields (`session.blocks`), has the site's own code draw each one
 * (`session.draw()`), falling back to drawing it from its fields alone, and
 * hands back what's edited, which the admin panel checks before publishing.
 */
import "@wordpress/components/build-style/style.css";
import "@wordpress/block-editor/build-style/style.css";
import "@wordpress/block-editor/build-style/content.css";
import "./editor.css";
import type { PluginAdmin, PluginEditorData, PluginEditorSession } from "@goodfellow-cms/core";
import { createRoot } from "react-dom/client";
import { fromGutenberg, toGutenberg } from "./convert.js";
import { type BlockRenderer, blockEditors } from "./edit.js";
import { type EditedPage, Editor } from "./editor.js";
import { editHistory } from "./history.js";
import { blockNames } from "./names.js";
import { outlineRenderer } from "./outline.js";
import { registerBlocks } from "./register.js";
import { styleFeatures } from "./styles.js";
import { compileTailwind } from "./tailwind.js";

/** Draws blocks as the site does, or from their fields alone where the site's code can't. */
export function sessionRenderer(session: Pick<PluginEditorSession, "blocks" | "draw">): BlockRenderer {
  const fallback = outlineRenderer({ blocks: session.blocks });
  return {
    render: (block) => session.draw(block).catch(() => fallback.render(block)),
  };
}

/** Adds a stylesheet to the frame's page, once. */
function loadStylesheet(doc: Document, href: string) {
  if ([...doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].some((link) => link.href === href)) return;
  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  doc.head.append(link);
}

const admin: PluginAdmin = {
  editor: {
    async mount(element, session) {
      const description = { blocks: session.blocks };
      const names = blockNames(description);
      registerBlocks(description, { ...blockEditors(description, names, sessionRenderer(session)), templates: true });

      const toPage = (data: PluginEditorData): EditedPage => ({
        blocks: toGutenberg(data.content, description, names),
        root: data.root,
      });
      const toData = (page: EditedPage): PluginEditorData => ({
        // Puck's older drop zones are edited only in Puck, so they go back as they came.
        ...(session.data.zones && { zones: session.data.zones }),
        root: page.root,
        content: fromGutenberg(page.blocks, description, names),
      });

      const history = editHistory(toPage(session.data));
      let selected: string | null = null;
      const tell = () =>
        session.change(toData(history.present), { past: history.canUndo, future: history.canRedo, selected });
      history.subscribe(tell);

      // The site's stylesheets, with its theme, scoped to the canvas: blocks are drawn as they are until they come.
      const root = createRoot(element as HTMLElement);
      const features = styleFeatures(session.settings.theme?.colors);
      const draw = (styles: { css: string }[]) =>
        root.render(
          <Editor
            history={history}
            description={description}
            names={names}
            rootFields={session.kind === "header" || session.kind === "footer" ? {} : session.root.fields}
            styles={styles}
            services={{ chooseMedia: (kind, value) => session.chooseMedia(kind, value), pages: session.pages }}
            sharePreview={session.kind === "header" || session.kind === "footer" ? undefined : (root) => session.sharePreview(root)}
            features={features}
            onSelect={(id) => {
              if (id === selected) return;
              selected = id;
              tell();
            }}
          />,
        );
      draw([]);
      let stopTailwind: (() => void) | undefined;
      session.styles().then(
        (styles) => {
          const site = styles.stylesheets.map((css) => ({ css }));
          draw(site);
          // Classes the site's last build hasn't seen, such as ones just chosen in Gutenberg's styling options,
          // compiled in the frame from the site's Tailwind source and scoped to the canvas with the site's own.
          stopTailwind = compileTailwind((element as HTMLElement).ownerDocument, styles.tailwind, (css) =>
            draw([...site, { css }]),
          );
          // The theme's Google Fonts, which Goodfellow after 0.6.0 gives and lets editor plugins' frames load.
          const fonts = (styles as { fonts?: string }).fonts;
          if (fonts) loadStylesheet((element as HTMLElement).ownerDocument, fonts);
        },
        () => {},
      );

      return {
        data: () => toData(history.present),
        set: (data) => history.push(toPage(data)),
        undo: () => {
          history.undo();
        },
        redo: () => {
          history.redo();
        },
        destroy: () => {
          stopTailwind?.();
          root.unmount();
        },
      };
    },
  },
};

export default admin;
