/**
 * What's edited, with its own undo and redo: Gutenberg's block editor keeps no
 * history of its own outside WordPress, so the plugin does, as the admin
 * panel's header asks it to.
 */
export interface EditHistory<T> {
  /** What's edited now. */
  readonly present: T;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** A change, which Undo takes back. */
  push(next: T): void;
  /** A change Undo doesn't take back on its own, such as each letter typed, joined to the change before it. */
  replace(next: T): void;
  undo(): T | undefined;
  redo(): T | undefined;
  /** Called after every change, undo and redo. */
  subscribe(listener: () => void): () => void;
}

export function editHistory<T>(initial: T): EditHistory<T> {
  const past: T[] = [];
  const future: T[] = [];
  let present = initial;
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of listeners) listener();
  };
  return {
    get present() {
      return present;
    },
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },
    push(next) {
      past.push(present);
      future.length = 0;
      present = next;
      changed();
    },
    replace(next) {
      present = next;
      changed();
    },
    undo() {
      const previous = past.pop();
      if (previous === undefined) return undefined;
      future.push(present);
      present = previous;
      changed();
      return present;
    },
    redo() {
      const next = future.pop();
      if (next === undefined) return undefined;
      past.push(present);
      present = next;
      changed();
      return present;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
