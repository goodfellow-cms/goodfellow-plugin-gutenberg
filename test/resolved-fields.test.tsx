/** A block's settings in the sidebar, for blocks that choose them in the site's code, such as the Comments block. */
import type { ComponentData } from "@puckeditor/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type BlockRenderer, useResolvedFields } from "../src/edit.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
afterEach(() => {
  container?.remove();
  vi.useRealTimers();
});

const FIELDS = { code: { type: "textarea" }, reactions: { type: "radio" } };

/** Draws the hook's answer for `props` as the names of the settings, and gives a way to change the props. */
function draw(renderer: BlockRenderer, block: { resolvesFields?: boolean } | undefined) {
  container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  function Settings({ props }: { props: Record<string, unknown> }) {
    return <p>{Object.keys(useResolvedFields(renderer, block, "comments", props, FIELDS)).join(",")}</p>;
  }
  const show = (props: Record<string, unknown>) => act(() => root.render(<Settings props={props} />));
  return { show, text: () => container.textContent };
}

const renderer = (fields: (block: ComponentData) => Record<string, unknown>) => ({
  render: async () => "",
  fields: vi.fn(async (block: ComponentData) => fields(block)),
});

describe("a block's settings", () => {
  it("are what the site's code gives for its props, a moment after they change", async () => {
    vi.useFakeTimers();
    const code = renderer((block) =>
      block.props.code ? { code: FIELDS.code } : { code: FIELDS.code, reactions: FIELDS.reactions },
    );
    const { show, text } = draw(code, { resolvesFields: true });
    show({ code: "" });
    // The description's, until the site's code answers.
    expect(text()).toBe("code,reactions");
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(text()).toBe("code,reactions");
    show({ code: "stjoseph" });
    show({ code: "stjoseph." });
    show({ code: "stjoseph" });
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(text()).toBe("code");
    // Asked once for the first props, and once after typing stopped.
    expect(code.fields).toHaveBeenCalledTimes(2);
  });

  it("are the description's for blocks that don't choose them, or where the site's code can't say", async () => {
    vi.useFakeTimers();
    const code = renderer(() => ({ code: FIELDS.code }));
    const plain = draw(code, undefined);
    plain.show({ code: "stjoseph" });
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(plain.text()).toBe("code,reactions");
    expect(code.fields).not.toHaveBeenCalled();
    container.remove();
    const older = draw({ render: async () => "" }, { resolvesFields: true });
    older.show({ code: "stjoseph" });
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(older.text()).toBe("code,reactions");
  });
});
