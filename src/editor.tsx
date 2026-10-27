/**
 * The editor itself: Gutenberg's block editor with the page's blocks, its
 * canvas drawn in the plugin's own frame, and a sidebar with the page's
 * settings and the selected block's. What's edited lives in an `EditHistory`,
 * which the admin panel's Undo and Redo, and the AI assistant, change too.
 */
import type { PluginEditorData, PluginSharePreview, SiteDescription } from "@goodfellow-cms/core";
import {
  BlockEditorProvider,
  BlockInspector,
  BlockList,
  BlockTools,
  __unstableEditorStyles as EditorStyles,
  __experimentalLibrary as InserterLibrary,
  __experimentalListView as ListView,
  store as blockEditorStore,
  WritingFlow,
} from "@wordpress/block-editor";
import type { Block as BlockInstance } from "@wordpress/blocks";
import { Button } from "@wordpress/components";
import { useRegistry, useSelect } from "@wordpress/data";
import { close, listView, plus } from "@wordpress/icons";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { withBlockIds } from "./convert.js";
import { FieldsPanel } from "./fields.js";
import type { EditHistory } from "./history.js";
import type { BlockNames } from "./names.js";
import { type EditorRegistry, insertPasted, isIntoText, pastedBlocks } from "./paste.js";
import { type EditorServices, Services } from "./rich-text-tools.js";
import { useInBetweenInserter } from "./inserters.js";
import { SharePreview } from "./share-preview.js";
import { SlashInserter } from "./slash.js";

/** What's edited, as the editor holds it: the page's blocks as Gutenberg's, and the rest as it came. */
export interface EditedPage {
  blocks: BlockInstance[];
  root: PluginEditorData["root"];
}

export interface EditorProps {
  history: EditHistory<EditedPage>;
  description: Pick<SiteDescription, "blocks">;
  names: BlockNames;
  /** The page settings' fields; the header and footer have none. */
  rootFields: Record<string, unknown>;
  /** The canvas's styles: the site's, and the plugin's own. */
  styles: { css: string }[];
  /** Told the selected block's id, or `null`, as it changes. */
  onSelect(id: string | null): void;
  /** What fields need from the admin panel: the media library, and the site's pages for links. */
  services: EditorServices;
  /** How a link to the page looks when it's shared; the header and footer have none. */
  sharePreview?(root: PluginEditorData["root"]): Promise<PluginSharePreview>;
  /** What Gutenberg's styling options offer (its theme.json features), from the site's theme: `styleFeatures()`. */
  features?: Record<string, unknown>;
}

/** What the panel on the left shows, if anything: the blocks to add, or the document overview. */
type LeftPanel = "inserter" | "overview" | null;

/** The panel on the left, as Gutenberg's editor has it. */
function Left({ panel, onClose }: { panel: Exclude<LeftPanel, null>; onClose(): void }) {
  const title = panel === "inserter" ? "Add a block" : "Document overview";
  return (
    <aside className="gf-editor-left" aria-label={title}>
      <div className="gf-editor-left-head">
        <h2>{title}</h2>
        <Button icon={close} label={`Close ${title.toLowerCase()}`} size="small" onClick={onClose} />
      </div>
      <div className="gf-editor-left-body">
        {panel === "inserter" ? (
          <InserterLibrary showInserterHelpPanel={false} showMostUsedBlocks={false} onClose={onClose} />
        ) : (
          <ListView showBlockMovers isExpanded />
        )}
      </div>
    </aside>
  );
}

/** The blocks `withBlockIds()` gave an id, with their props as they now are. */
function newIds(before: BlockInstance[], after: BlockInstance[]): Array<[string, Record<string, unknown>]> {
  const found: Array<[string, Record<string, unknown>]> = [];
  before.forEach((block, index) => {
    const now = after[index];
    if (!now || now === block) return;
    const props = (now.attributes as { props?: Record<string, unknown> }).props;
    if (props && props !== (block.attributes as { props?: unknown }).props) found.push([block.clientId, props]);
    found.push(...newIds(block.innerBlocks, now.innerBlocks));
  });
  return found;
}

/** Hands the editor Gutenberg's store, which the provider makes. */
function RegistryRef({ into }: { into: { current: EditorRegistry | undefined } }) {
  into.current = useRegistry() as EditorRegistry;
  return null;
}

/** The selected block's id, as content has it, for the AI assistant. */
function Selection({ onSelect }: Pick<EditorProps, "onSelect">) {
  const selected = useSelect((select) => {
    const block = (select(blockEditorStore) as { getSelectedBlock(): BlockInstance | null }).getSelectedBlock();
    const id = (block?.attributes as { props?: { id?: unknown } } | undefined)?.props?.id;
    return typeof id === "string" ? id : null;
  }, []);
  useEffect(() => onSelect(selected), [onSelect, selected]);
  return null;
}

/**
 * Gutenberg's canvas without the iframe it would draw it in, since the
 * plugin's frame is sandboxed already and its policy allows no frames: the
 * same parts `BlockCanvas` puts together when told not to use one, with the
 * site's styles scoped to the canvas.
 */
function Canvas({ styles, description, names }: Pick<EditorProps, "styles" | "description" | "names">) {
  const content = useRef<HTMLDivElement>(null);
  const registry = useRegistry() as EditorRegistry;
  // Every paste, before Gutenberg's own handler, which would make WordPress's blocks: into text being edited, the
  // text takes it; anywhere else, it becomes the site's blocks.
  useEffect(() => {
    // The plugin's own frame's page, which the canvas is in.
    const doc = document;
    const paste = (event: ClipboardEvent) => {
      if (isIntoText(event.target) || !event.clipboardData) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      insertPasted(
        registry,
        pastedBlocks(
          { html: event.clipboardData.getData("text/html"), text: event.clipboardData.getData("text/plain") },
          description,
          names,
        ),
      );
    };
    doc.addEventListener("paste", paste, true);
    return () => doc.removeEventListener("paste", paste, true);
  }, [description, names, registry]);
  useInBetweenInserter(content, registry);
  return (
    <BlockTools __unstableContentRef={content} style={{ height: "100%", display: "flex" }}>
      <EditorStyles styles={styles} scope=":where(.editor-styles-wrapper)" />
      <WritingFlow
        ref={content}
        className="editor-styles-wrapper"
        tabIndex={-1}
        style={{ height: "100%", width: "100%", overflow: "auto" }}
      >
        <BlockList />
      </WritingFlow>
      <SlashInserter content={content} registry={registry} />
    </BlockTools>
  );
}

export function Editor({
  history,
  description,
  names,
  rootFields,
  styles,
  onSelect,
  services,
  sharePreview,
  features,
}: EditorProps) {
  const settings = useMemo(() => ({ __experimentalFeatures: features ?? {} }), [features]);
  const [left, setLeft] = useState<LeftPanel>(null);
  const toggle = (panel: Exclude<LeftPanel, null>) => setLeft((open) => (open === panel ? null : panel));
  const page = useSyncExternalStore(history.subscribe, () => history.present);
  const registry = useRef<EditorRegistry>(undefined);
  const setBlocks = (changed: BlockInstance[], keep: boolean) => {
    if (changed === history.present.blocks) return;
    // Blocks just added, or duplicated, get ids of their own in Gutenberg's own store, which then hands them back
    // with them: handing Gutenberg other blocks than its own would start it again, losing what's selected.
    const withIds = withBlockIds(changed, names);
    if (withIds !== changed && registry.current) {
      const update = (registry.current.dispatch(blockEditorStore) as {
        updateBlockAttributes(clientId: string, attributes: Record<string, unknown>): void;
      }).updateBlockAttributes;
      for (const [clientId, props] of newIds(changed, withIds)) update(clientId, { props });
      return;
    }
    const next = { ...history.present, blocks: withIds };
    if (keep) history.push(next);
    else history.replace(next);
  };
  return (
    <BlockEditorProvider
      value={page.blocks}
      onInput={(blocks) => setBlocks(blocks, false)}
      onChange={(blocks) => setBlocks(blocks, true)}
      settings={settings}
    >
      <RegistryRef into={registry} />
      <Services.Provider value={services}>
        <div className="gf-editor">
          <div className="gf-editor-toolbar" role="toolbar" aria-label="Document tools">
            <Button
              icon={plus}
              label="Add a block"
              variant={left === "inserter" ? "primary" : undefined}
              isPressed={left === "inserter"}
              onClick={() => toggle("inserter")}
            />
            <Button
              icon={listView}
              label="Document overview"
              isPressed={left === "overview"}
              onClick={() => toggle("overview")}
            />
          </div>
          <div className="gf-editor-main">
            {left && <Left panel={left} onClose={() => setLeft(null)} />}
            <div className="gf-editor-canvas">
              <Canvas styles={styles} description={description} names={names} />
            </div>
          <aside className="gf-editor-sidebar" aria-label="Settings">
            <FieldsPanel
              title="Page settings"
              fields={rootFields}
              props={page.root.props ?? {}}
              onChange={(props) => history.push({ ...history.present, root: { ...history.present.root, props } })}
            >
              {sharePreview && <SharePreview root={page.root} preview={sharePreview} />}
            </FieldsPanel>
            <BlockInspector />
          </aside>
          </div>
        </div>
        <Selection onSelect={onSelect} />
      </Services.Provider>
    </BlockEditorProvider>
  );
}
