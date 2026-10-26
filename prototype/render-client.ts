/** Asks the render frame (`render.tsx`) to draw blocks, as the plugin would ask the admin panel's. */
import type { ComponentData } from "@puckeditor/core";
import type { BlockRenderer } from "../src/edit.js";

export function frameRenderer(src: string): BlockRenderer {
  const frame = document.createElement("iframe");
  frame.src = src;
  frame.hidden = true;
  frame.title = "";
  const ready = new Promise<void>((resolve) => {
    window.addEventListener("message", function onReady(event) {
      if (event.source === frame.contentWindow && (event.data as { ready?: boolean })?.ready) {
        window.removeEventListener("message", onReady);
        resolve();
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
  return {
    async render(block: ComponentData) {
      await ready;
      const id = next++;
      return new Promise<string>((resolve, reject) => {
        waiting.set(id, { resolve, reject });
        frame.contentWindow?.postMessage({ id, block }, "*");
      });
    },
  };
}
