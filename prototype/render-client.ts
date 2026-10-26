/** Asks the render frame (`render.tsx`) to draw blocks, as the plugin would ask the admin panel's. */
import type { SiteDescription, SiteSettings } from "@goodfellow-cms/core";
import type { ComponentData } from "@puckeditor/core";
import type { BlockRenderer } from "../src/edit.js";

/** What the editor opens with, as an editor plugin's session gives it. */
export interface OpenedSite {
  description: SiteDescription;
  settings: SiteSettings;
  /** The home page's blocks. */
  content: ComponentData[];
}

/** The render frame, and the site it opens once it's ready. */
export function renderFrame(src: string): { opened: Promise<OpenedSite>; renderer: BlockRenderer } {
  const frame = document.createElement("iframe");
  frame.src = src;
  frame.hidden = true;
  frame.title = "";
  const ready = new Promise<OpenedSite>((resolve) => {
    window.addEventListener("message", function onReady(event) {
      const data = event.data as { ready?: boolean; site?: OpenedSite };
      if (event.source === frame.contentWindow && data?.ready && data.site) {
        window.removeEventListener("message", onReady);
        resolve(data.site);
      }
    });
  });
  document.body.append(frame);
  let next = 0;
  const waiting = new Map<number, { resolve: (html: string) => void; reject: (error: Error) => void }>();
  window.addEventListener("message", (event) => {
    if (event.source !== frame.contentWindow) return;
    const { id, html, error } = event.data as { id?: number; html?: string; error?: string };
    const request = id === undefined ? undefined : waiting.get(id);
    if (!request) return;
    waiting.delete(id as number);
    if (typeof html === "string") request.resolve(html);
    else request.reject(new Error(error ?? "The block couldn't be drawn."));
  });
  const renderer: BlockRenderer = {
    async render(block: ComponentData) {
      await ready;
      const id = next++;
      return new Promise<string>((resolve, reject) => {
        waiting.set(id, { resolve, reject });
        frame.contentWindow?.postMessage({ id, block }, "*");
      });
    },
  };
  return { opened: ready, renderer };
}
