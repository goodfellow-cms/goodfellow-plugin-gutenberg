/**
 * The parts of `@wordpress/block-editor` the plugin uses, which the package
 * itself has no types for.
 */
declare module "@wordpress/block-editor" {
  import type { ComponentType, ReactNode } from "react";
  import type { Block } from "@wordpress/blocks";

  export const store: string;
  export function useBlockProps(props?: Record<string, unknown>): Record<string, unknown>;
  export function useInnerBlocksProps(
    props?: Record<string, unknown>,
    options?: { templateLock?: "all" | "insert" | "contentOnly" | false; renderAppender?: false | ComponentType },
  ): Record<string, unknown>;
  export const InspectorControls: ComponentType<{ children?: ReactNode }>;
  export const BlockEditorProvider: ComponentType<{
    value: Block[];
    onInput?: (blocks: Block[]) => void;
    onChange?: (blocks: Block[]) => void;
    settings?: Record<string, unknown>;
    children?: ReactNode;
  }>;
  export const BlockCanvas: ComponentType<{ height?: string; styles?: { css: string }[] }>;
  export const BlockTools: ComponentType<{ children?: ReactNode }>;
  export const BlockInspector: ComponentType;
}
