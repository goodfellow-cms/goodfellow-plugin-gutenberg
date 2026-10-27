/** The sidebar's fields for lists of items, tables, media and the site's own fields, as an editor uses them. */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FieldsPanel } from "../src/fields.js";
import { Services } from "../src/rich-text-tools.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
afterEach(() => container?.remove());

/** The panel drawn with `fields` and `props`, answering with what each change made. */
function draw(
  fields: Record<string, unknown>,
  props: Record<string, unknown>,
  chooseMedia = vi.fn(async (): Promise<string | null> => null),
) {
  container = document.body.appendChild(document.createElement("div"));
  const changes: Record<string, unknown>[] = [];
  const root = createRoot(container);
  act(() =>
    root.render(
      <Services.Provider value={{ chooseMedia, pages: [] }}>
        <FieldsPanel title="Settings" fields={fields} props={props} onChange={(next) => changes.push(next)} />
      </Services.Provider>,
    ),
  );
  const button = (name: string) =>
    [...container.querySelectorAll("button")].find((element) => element.textContent?.trim() === name || element.getAttribute("aria-label") === name);
  return { changes, button, chooseMedia };
}

describe("the sidebar", () => {
  const images = {
    type: "array",
    label: "Pictures",
    arrayFields: {
      src: { type: "text", label: "Picture", metadata: { media: "image" } },
      caption: { type: "text", label: "Caption" },
    },
    defaultItemProps: { src: "", caption: "" },
  };

  it("adds, moves and removes a list's items", () => {
    const items = [
      { src: "/media/a.jpg", caption: "First" },
      { src: "/media/b.jpg", caption: "Second" },
    ];
    const { changes, button } = draw({ images }, { images: items });
    expect(container.textContent).toContain("First");
    act(() => button("Add")?.click());
    expect(changes.at(-1)?.images).toEqual([...items, { src: "", caption: "" }]);
    const [, down] = [...container.querySelectorAll('button[aria-label="Move down"]')] as HTMLButtonElement[];
    expect(down?.disabled).toBe(true);
    act(() => (container.querySelector('button[aria-label="Move down"]') as HTMLButtonElement).click());
    expect(changes.at(-1)?.images).toEqual([items[1], items[0]]);
    act(() => (container.querySelector('button[aria-label="Remove"]') as HTMLButtonElement).click());
    expect(changes.at(-1)?.images).toEqual([items[1]]);
  });

  it("chooses media from the admin panel's media library", async () => {
    const chooseMedia = vi.fn(async (): Promise<string | null> => "/media/new.jpg");
    const { changes, button } = draw(
      { image: { type: "text", label: "Image", metadata: { media: "image" } } },
      { image: "" },
      chooseMedia,
    );
    await act(async () => button("Choose from the media library")?.click());
    expect(chooseMedia).toHaveBeenCalledWith("image", undefined);
    expect(changes.at(-1)).toEqual({ image: "/media/new.jpg" });
  });

  it("edits a table's cells, and adds rows and columns", () => {
    const { changes, button } = draw(
      { cells: { type: "custom", label: "Cells", metadata: { table: true } } },
      { cells: [["a", "b"]] },
    );
    act(() => button("Add a row")?.click());
    expect(changes.at(-1)?.cells).toEqual([
      ["a", "b"],
      ["", ""],
    ]);
    act(() => button("Add a column")?.click());
    expect(changes.at(-1)?.cells).toEqual([["a", "b", ""]]);
    expect(container.querySelectorAll("input.gf-table-cell")).toHaveLength(2);
  });

  it("names the site's own fields, which only the standard editor can change, and leaves out hidden ones", () => {
    draw(
      { schedule: { type: "custom", label: "Opening hours" }, value: { type: "richtext", visible: false } },
      {},
    );
    expect(container.textContent).toContain("Opening hours");
    expect(container.textContent).toContain("standard editor");
    expect(container.querySelector(".gf-rich-text-field")).toBeNull();
  });
});
