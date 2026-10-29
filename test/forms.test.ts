/** Forms in the plugin's frame, whose sandbox submits none: the plugin sends their submit itself. */
import { afterEach, describe, expect, it } from "vitest";
import { submitFormsInSandbox } from "../src/forms.js";

let stop: (() => void) | undefined;
afterEach(() => {
  stop?.();
  document.body.innerHTML = "";
});

/** A form with `html` in it, counting its submits and naming the button that sent each. */
function form(html: string) {
  document.body.innerHTML = `<form>${html}</form>`;
  const element = document.querySelector("form") as HTMLFormElement;
  const submits: (string | null)[] = [];
  element.addEventListener("submit", (event) => {
    event.preventDefault();
    submits.push((event as SubmitEvent).submitter?.textContent ?? null);
  });
  stop = submitFormsInSandbox(document);
  return { element, submits };
}

function enter(field: Element) {
  field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
}

describe("forms in the sandbox", () => {
  it("submits a form from its submit button, once, naming the button", () => {
    const { element, submits } = form('<input type="text"><button type="button">Cancel</button><button>Apply</button>');
    (element.querySelector("button:last-child") as HTMLButtonElement).click();
    (element.querySelector("button") as HTMLButtonElement).click();
    expect(submits).toEqual(["Apply"]);
  });

  it("submits a form with Enter in a text field, as its default button would", () => {
    const { element, submits } = form('<input type="text"><input type="checkbox"><button>Add link</button>');
    enter(element.querySelector("input[type=text]") as Element);
    enter(element.querySelector("input[type=checkbox]") as Element);
    expect(submits).toEqual(["Add link"]);
  });

  it("leaves a form alone where its button is disabled, or its own handler took the click or the key", () => {
    const disabled = form('<input type="text"><button disabled>Apply</button>');
    enter(disabled.element.querySelector("input") as Element);
    (disabled.element.querySelector("button") as HTMLButtonElement).click();
    expect(disabled.submits).toEqual([]);
    stop?.();

    const handled = form('<input type="text"><button>Apply</button>');
    for (const type of ["click", "keydown"]) handled.element.addEventListener(type, (event) => event.preventDefault());
    (handled.element.querySelector("button") as HTMLButtonElement).click();
    enter(handled.element.querySelector("input") as Element);
    expect(handled.submits).toEqual([]);
  });

  it("submits a form without a button from Enter only where it has one text field, as browsers do", () => {
    const one = form('<input type="search">');
    enter(one.element.querySelector("input") as Element);
    expect(one.submits).toEqual([null]);
    stop?.();
    const two = form('<input type="text"><input type="text">');
    enter(two.element.querySelector("input") as Element);
    expect(two.submits).toEqual([]);
  });
});
