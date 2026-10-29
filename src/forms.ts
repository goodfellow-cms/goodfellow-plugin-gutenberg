/**
 * Forms in the plugin's frame. Goodfellow sandboxes plugins' frames with
 * scripts alone, never `allow-forms`, so browsers submit no form there, and
 * don't even fire its `submit` event: Gutenberg's dialogs (Hide, Rename) and
 * the link form, which only ever handle that event, would do nothing. So a
 * submit button's click, or Enter in one of a form's fields, sends the event
 * itself. It isn't trusted, so the browser never submits the form for it.
 */

/** Input types Enter submits the form from, as browsers' implicit submission does. */
const SUBMITS_ON_ENTER = new Set([
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
  "number",
  "date",
  "datetime-local",
  "month",
  "week",
  "time",
]);

interface Submitter extends HTMLElement {
  type: string;
  disabled: boolean;
  form: HTMLFormElement | null;
}

function isSubmitter(element: Element | null | undefined): element is Submitter {
  if (!element || !("form" in element) || !("type" in element)) return false;
  const type = (element as Submitter).type;
  return (element.localName === "button" || element.localName === "input") && (type === "submit" || type === "image");
}

/** The form's default button, the first that submits it, which Enter presses. */
function defaultButton(form: HTMLFormElement): Submitter | undefined {
  return Array.from(form.elements).find((element): element is Submitter => isSubmitter(element));
}

function submit(form: HTMLFormElement, submitter: HTMLElement | null) {
  const view = form.ownerDocument.defaultView;
  const Submit = view?.SubmitEvent;
  const event = Submit
    ? new Submit("submit", { bubbles: true, cancelable: true, submitter })
    : new (view?.Event ?? Event)("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(event);
}

/**
 * Has `doc`'s forms send their `submit` event where the sandbox stops them,
 * after their own handlers, so a click or Enter they've handled themselves
 * (`preventDefault()`) is left to them. Returns what stops it.
 */
export function submitFormsInSandbox(doc: Document): () => void {
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    const button = (event.target as Element | null)?.closest?.("button, input");
    if (!isSubmitter(button) || button.disabled || !button.form) return;
    event.preventDefault();
    submit(button.form, button);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || event.defaultPrevented || event.isComposing) return;
    const field = event.target as HTMLInputElement | null;
    if (field?.localName !== "input" || !SUBMITS_ON_ENTER.has(field.type) || !field.form) return;
    const form = field.form;
    const button = defaultButton(form);
    if (button?.disabled) return;
    event.preventDefault();
    if (button) submit(form, button);
    // Without a button, Enter submits only a form with one such field, as browsers do.
    else if (Array.from(form.elements).filter((element) => SUBMITS_ON_ENTER.has((element as HTMLInputElement).type)).length === 1) {
      submit(form, null);
    }
  };
  doc.addEventListener("click", onClick);
  doc.addEventListener("keydown", onKeyDown);
  return () => {
    doc.removeEventListener("click", onClick);
    doc.removeEventListener("keydown", onKeyDown);
  };
}
