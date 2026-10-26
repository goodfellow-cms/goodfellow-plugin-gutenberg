/**
 * The editor itself: Gutenberg's block editor with the page's blocks, its
 * canvas drawn in the plugin's own frame, and a sidebar with the page's
 * settings and the selected block's. What's edited lives in an `EditHistory`,
 * which the admin panel's Undo and Redo, and the AI assistant, change too.
 */
import type { PluginEditorData } from "@goodfellow-cms/core";
import {
  BlockEditorProvider,
  BlockInspector,
  BlockList,
  BlockTools,
  __unstableEditorStyles as EditorStyles,
  store as blockEditorStore,
  WritingFlow,
} from "@wordpress/block-editor";
import type { Block as BlockInstance } from "@wordpress/blocks";
import { useSelect } from "@wordpress/data";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { withBlockIds } from "./convert.js";
import { FieldsPanel } from "./fields.js";
import type { EditHistory } from "./history.js";
import type { BlockNames } from "./names.js";

/** What's edited, as the editor holds it: the page's blocks as Gutenberg's, and the rest as it came. */
export interface EditedPage {
  blocks: BlockInstance[];
  root: PluginEditorData["root"];
}

export interface EditorProps {
  history: EditHistory<EditedPage>;
  names: BlockNames;
  /** The page settings' fields; the header and footer have none. */
  rootFields: Record<string, unknown>;
  /** The canvas's styles: the site's, and the plugin's own. */
  styles: { css: string }[];
  /** Told the selected block's id, or `null`, as it changes. */
  onSelect(id: string | null): void;
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
function Canvas({ styles }: Pick<EditorProps, "styles">) {
  const content = useRef<HTMLDivElement>(null);
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
    </BlockTools>
  );
}

export function Editor({ history, names, rootFields, styles, onSelect }: EditorProps) {
  const page = useSyncExternalStore(history.subscribe, () => history.present);
  const setBlocks = (changed: BlockInstance[], keep: boolean) => {
    if (changed === history.present.blocks) return;
    // Blocks just added, or duplicated, get ids of their own, which Gutenberg then shows them with.
    const next = { ...history.present, blocks: withBlockIds(changed, names) };
    if (keep) history.push(next);
    else history.replace(next);
  };
  return (
    <BlockEditorProvider
      value={page.blocks}
      onInput={(blocks) => setBlocks(blocks, false)}
      onChange={(blocks) => setBlocks(blocks, true)}
      settings={{}}
    >
      <div className="gf-editor">
        <div className="gf-editor-canvas">
          <Canvas styles={styles} />
        </div>
        <aside className="gf-editor-sidebar" aria-label="Settings">
          <FieldsPanel
            title="Page settings"
            fields={rootFields}
            props={page.root.props ?? {}}
            onChange={(props) => history.push({ ...history.present, root: { ...history.present.root, props } })}
          />
          <BlockInspector />
        </aside>
      </div>
      <Selection onSelect={onSelect} />
    </BlockEditorProvider>
  );
}
