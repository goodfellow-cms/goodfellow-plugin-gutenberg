/**
 * The parts of `@wordpress/block-editor` the plugin uses, which the package
 * itself has no types for.
 */
declare module "@wordpress/block-editor" {
  import type { ComponentType, CSSProperties, ReactNode, Ref, RefObject } from "react";
  import type { Block } from "@wordpress/blocks";

  export const store: string;
  export function useBlockProps(props?: Record<string, unknown>): Record<string, unknown>;
  export function useInnerBlocksProps(
    props?: Record<string, unknown>,
    options?: {
      templateLock?: "all" | "insert" | "contentOnly" | false;
      renderAppender?: false | ComponentType;
    },
  ): Record<string, unknown>;
  export const InspectorControls: ComponentType<{ children?: ReactNode }>;
  export const InnerBlocks: { Content: ComponentType };
  export const BlockControls: ComponentType<{ children?: ReactNode; group?: "default" | "block" | "inline" | "other" }>;
  export const BlockEditorProvider: ComponentType<{
    value: Block[];
    onInput?: (blocks: Block[]) => void;
    onChange?: (blocks: Block[]) => void;
    settings?: Record<string, unknown>;
    children?: ReactNode;
  }>;
  export const BlockCanvas: ComponentType<{ height?: string; styles?: { css: string }[] }>;
  export const BlockTools: ComponentType<{
    children?: ReactNode;
    __unstableContentRef?: RefObject<HTMLElement | null>;
    style?: CSSProperties;
  }>;
  export const BlockInspector: ComponentType;
  export const BlockList: ComponentType;
  export const WritingFlow: ComponentType<{
    children?: ReactNode;
    ref?: Ref<HTMLDivElement>;
    className?: string;
    tabIndex?: number;
    style?: CSSProperties;
  }>;
  /** A block type's icon, as Gutenberg's lists show it. */
  export const BlockIcon: ComponentType<{ icon?: unknown; showColors?: boolean; className?: string }>;
  /** The inserter's list of blocks, as Gutenberg's sidebar shows it. */
  export const __experimentalLibrary: ComponentType<{
    rootClientId?: string;
    showInserterHelpPanel?: boolean;
    showMostUsedBlocks?: boolean;
    shouldFocusBlock?: boolean;
    onSelect?: () => void;
    onClose?: () => void;
  }>;
  /** The document overview: every block, nested as they are. */
  export const __experimentalListView: ComponentType<{ showBlockMovers?: boolean; isExpanded?: boolean }>;
  /** Puts styles in the page, scoped to `scope`, as the canvas does without its iframe. */
  export const __unstableEditorStyles: ComponentType<{ styles: { css: string }[]; scope?: string }>;
}

declare module "@tailwindcss/browser";
