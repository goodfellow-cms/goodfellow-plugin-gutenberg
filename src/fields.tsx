/**
 * A block's settings in Gutenberg's sidebar, from the fields in the site's
 * description: the plugin has no code of the site's to draw them with, so
 * each field type the description names gets Gutenberg's own control. Fields
 * only the site's code can draw are named, with where to edit them.
 */
import type { SiteDescription } from "@goodfellow-cms/core";
import { InspectorControls } from "@wordpress/block-editor";
import {
  BaseControl,
  Button,
  PanelBody,
  RadioControl,
  SelectControl,
  TextareaControl,
  TextControl,
  Toolbar,
} from "@wordpress/components";
import { arrowDown, arrowUp, plus, trash } from "@wordpress/icons";
import { type ReactNode, useContext, useEffect, useId, useRef, useState } from "react";
import { cleanRichText, tidyRichText } from "./rich-text.js";
import { RichTextTools, Services } from "./rich-text-tools.js";

/** A field as the site's description has it: Puck's field, as JSON. */
export interface Field {
  type: string;
  label?: string;
  options?: Option[];
  placeholder?: string;
  visible?: boolean;
  contentEditable?: boolean;
  metadata?: { media?: MediaKind; table?: boolean; [key: string]: unknown };
  arrayFields?: Record<string, Field>;
  objectFields?: Record<string, Field>;
  defaultItemProps?: Record<string, unknown>;
  min?: number;
  max?: number;
}

type MediaKind = "image" | "video" | "audio" | "file";

type Fields = SiteDescription["blocks"][string]["fields"];

interface Option {
  value: unknown;
  label: string;
}

function options(field: Field): Option[] {
  return (field.options ?? []).map(({ value, label }) => ({ value, label }));
}

/** Options' values as Gutenberg's controls hold them, which is text, and back. */
function optionValue(field: Field, text: string): unknown {
  return options(field).find((option) => String(option.value) === text)?.value ?? text;
}

/** Whether a field is shown in the sidebar: slots are blocks, and hidden fields are filled in by the site's code. */
export function isShown(field: Field): boolean {
  return field.type !== "slot" && field.visible !== false;
}

interface ControlProps {
  name: string;
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
}

/** A media field: the file chosen, and the media library to choose another. */
function MediaControl({ name, field, value, onChange }: ControlProps) {
  const { chooseMedia, mediaUrl = (url: string) => url } = useContext(Services);
  const kind = field.metadata?.media ?? "file";
  const address = typeof value === "string" ? value : "";
  const id = useId();
  return (
    <BaseControl id={id} label={field.label ?? name} __nextHasNoMarginBottom>
      <div className="gf-media">
        {address && kind === "image" && <img className="gf-media-preview" src={mediaUrl(address)} alt="" />}
        {address && <p className="gf-media-name">{address.split("/").pop()}</p>}
        <div className="gf-media-actions">
          <Button
            id={id}
            variant="secondary"
            onClick={() =>
              chooseMedia(kind, address || undefined).then(
                (chosen) => chosen !== null && onChange(chosen),
                () => {},
              )
            }
          >
            {address ? "Replace" : "Choose from the media library"}
          </Button>
          {address && (
            <Button variant="tertiary" isDestructive onClick={() => onChange("")}>
              Remove
            </Button>
          )}
        </div>
      </div>
    </BaseControl>
  );
}

/** Plain text as HTML: paragraphs where there are blank lines, and line breaks within them. */
export function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .split(/\r?\n\s*\r?\n/)
    .filter((paragraph) => paragraph.trim() !== "")
    .map((paragraph) => `<p>${paragraph.trim().replace(/\r?\n/g, "<br>")}</p>`)
    .join("");
}

/** Pastes into rich text only what rich text keeps. */
export function pasteRichText(event: ClipboardEvent | React.ClipboardEvent<HTMLElement>): void {
  const data = event.clipboardData;
  const target = event.currentTarget as HTMLElement | null;
  if (!data || !target) return;
  event.preventDefault();
  const pasted = data.getData("text/html") || escapeText(data.getData("text/plain"));
  target.ownerDocument.execCommand("insertHTML", false, cleanRichText(pasted, target.ownerDocument));
}

/** Rich text in the sidebar, where the block shows it somewhere it can't be edited in place. */
function RichTextControl({ name, field, value, onChange }: ControlProps) {
  const element = useRef<HTMLDivElement>(null);
  const html = typeof value === "string" ? value : "";
  useEffect(() => {
    const current = element.current;
    if (current && cleanRichText(current.innerHTML, current.ownerDocument) !== html) current.innerHTML = html;
  }, [html]);
  const id = useId();
  return (
    <BaseControl id={id} label={field.label ?? name} __nextHasNoMarginBottom>
      <Toolbar label="Formatting" className="gf-rich-text-toolbar">
        <RichTextTools elements={() => (element.current ? [element.current] : [])} />
      </Toolbar>
      <div
        ref={element}
        id={id}
        className="gf-rich-text-field"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        tabIndex={0}
        onInput={(event) => {
          tidyRichText(event.currentTarget);
          onChange(cleanRichText(event.currentTarget.innerHTML, event.currentTarget.ownerDocument));
        }}
        onPaste={pasteRichText}
      />
    </BaseControl>
  );
}

/** A short name for an item of a list, from its first words. */
export function itemSummary(fields: Record<string, Field>, item: Record<string, unknown>, index: number): string {
  for (const [name, field] of Object.entries(fields)) {
    const value = item[name];
    const words = (field.type === "text" || field.type === "textarea") && !field.metadata?.media;
    if (words && typeof value === "string" && value.trim()) return value.trim().slice(0, 60);
  }
  return `Item ${index + 1}`;
}

/** A list of items, each with the same fields, as Puck's array fields are. */
function ListControl({ name, field, value, onChange }: ControlProps) {
  const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  const fields = field.arrayFields ?? {};
  const [open, setOpen] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    onChange(next);
    setOpen(open === from ? to : open);
  };
  const canAdd = field.max === undefined || items.length < field.max;
  const canRemove = field.min === undefined || items.length > field.min;
  return (
    <fieldset className="gf-group">
      <legend className="gf-group-label">{field.label ?? name}</legend>
      <ul className="gf-list-items">
        {items.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: items have no ids of their own, and keep their place
          <li key={index} className="gf-list-item">
            <div className="gf-list-item-head">
              <Button
                className="gf-list-item-name"
                aria-expanded={open === index}
                onClick={() => setOpen(open === index ? null : index)}
              >
                {itemSummary(fields, item, index)}
              </Button>
              <Button
                icon={arrowUp}
                label="Move up"
                size="small"
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
              />
              <Button
                icon={arrowDown}
                label="Move down"
                size="small"
                disabled={index === items.length - 1}
                onClick={() => move(index, index + 1)}
              />
              <Button
                icon={trash}
                label="Remove"
                size="small"
                isDestructive
                disabled={!canRemove}
                onClick={() => {
                  onChange(items.filter((_, other) => other !== index));
                  setOpen(null);
                }}
              />
            </div>
            {open === index && (
              <div className="gf-list-item-fields">
                <FieldControls
                  fields={fields}
                  props={item}
                  onChange={(next) => onChange(items.map((other, at) => (at === index ? next : other)))}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      <Button
        variant="secondary"
        icon={plus}
        disabled={!canAdd}
        onClick={() => {
          onChange([...items, structuredClone(field.defaultItemProps ?? {})]);
          setOpen(items.length);
        }}
      >
        Add
      </Button>
    </fieldset>
  );
}

/** A table's cells, rows of plain text, made square. */
export function tableRows(value: unknown): string[][] {
  const rows = Array.isArray(value)
    ? (value as unknown[]).map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : []))
    : [];
  const columns = Math.max(1, ...rows.map((row) => row.length));
  return rows.map((row) => Array.from({ length: columns }, (_, column) => row[column] ?? ""));
}

/** A table's cells, rows of plain text, as the Table block keeps them. */
function TableControl({ name, field, value, onChange }: ControlProps) {
  const rows = tableRows(value);
  const columns = rows[0]?.length ?? 1;
  const setCell = (row: number, column: number, text: string) =>
    onChange(rows.map((cells, r) => (r === row ? cells.map((cell, c) => (c === column ? text : cell)) : cells)));
  return (
    <fieldset className="gf-group">
      <legend className="gf-group-label">{field.label ?? name}</legend>
      <div className="gf-table-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(4rem, 1fr))` }}>
        {rows.flatMap((cells, row) =>
          cells.map((cell, column) => (
            <input
              // biome-ignore lint/suspicious/noArrayIndexKey: cells are where they are
              key={`${row}-${column}`}
              className="gf-table-cell"
              aria-label={`Row ${row + 1}, column ${column + 1}`}
              value={cell}
              onChange={(event) => setCell(row, column, event.target.value)}
            />
          )),
        )}
      </div>
      <div className="gf-table-actions">
        <Button variant="secondary" size="small" onClick={() => onChange([...rows, Array.from({ length: columns }, () => "")])}>
          Add a row
        </Button>
        <Button variant="secondary" size="small" onClick={() => onChange(rows.map((cells) => [...cells, ""]))}>
          Add a column
        </Button>
        <Button variant="tertiary" size="small" disabled={rows.length <= 1} onClick={() => onChange(rows.slice(0, -1))}>
          Remove the last row
        </Button>
        <Button
          variant="tertiary"
          size="small"
          disabled={columns <= 1}
          onClick={() => onChange(rows.map((cells) => cells.slice(0, -1)))}
        >
          Remove the last column
        </Button>
      </div>
    </fieldset>
  );
}

function FieldControl({ name, field, value, onChange }: ControlProps) {
  const label = field.label ?? name;
  const shared = { label, __nextHasNoMarginBottom: true };
  switch (field.type) {
    case "text":
      if (field.metadata?.media) return <MediaControl name={name} field={field} value={value} onChange={onChange} />;
      return (
        <TextControl
          {...shared}
          __next40pxDefaultSize
          placeholder={field.placeholder}
          value={String(value ?? "")}
          onChange={onChange}
        />
      );
    case "number":
      return (
        <TextControl
          {...shared}
          __next40pxDefaultSize
          type="number"
          min={field.min}
          max={field.max}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(text) => onChange(text === "" ? undefined : Number(text))}
        />
      );
    case "textarea":
      return (
        <TextareaControl {...shared} placeholder={field.placeholder} value={String(value ?? "")} onChange={onChange} />
      );
    case "richtext":
      return <RichTextControl name={name} field={field} value={value} onChange={onChange} />;
    case "select":
      return (
        <SelectControl
          {...shared}
          __next40pxDefaultSize
          value={String(value ?? "")}
          options={options(field).map((option) => ({ value: String(option.value), label: option.label }))}
          onChange={(text: string) => onChange(optionValue(field, text))}
        />
      );
    case "radio":
      return (
        <RadioControl
          label={label}
          selected={String(value ?? "")}
          options={options(field).map((option) => ({ value: String(option.value), label: option.label }))}
          onChange={(text: string) => onChange(optionValue(field, text))}
        />
      );
    case "array":
      return <ListControl name={name} field={field} value={value} onChange={onChange} />;
    case "object":
      return (
        <fieldset className="gf-group">
          <legend className="gf-group-label">{label}</legend>
          <FieldControls
            fields={field.objectFields ?? {}}
            props={value && typeof value === "object" ? (value as Record<string, unknown>) : {}}
            onChange={onChange}
          />
        </fieldset>
      );
    case "custom":
      if (field.metadata?.table) return <TableControl name={name} field={field} value={value} onChange={onChange} />;
      // The site's own field, which only its code can draw.
      return (
        <p className="gf-field-note">
          <strong>{label}</strong>: change this in the standard editor, which you can choose in the editor's header.
        </p>
      );
    default:
      return null;
  }
}

/** Fields one under another, changing `props` one at a time. */
function FieldControls({
  fields,
  props,
  onChange,
  hidden,
}: {
  fields: Record<string, Field>;
  props: Record<string, unknown>;
  onChange: (props: Record<string, unknown>) => void;
  hidden?: ReadonlySet<string>;
}) {
  return (
    <>
      {Object.entries(fields)
        .filter(([name, field]) => isShown(field) && !hidden?.has(name))
        .map(([name, field]) => (
          <div key={name} className="gf-field">
            <FieldControl
              name={name}
              field={field}
              value={props[name]}
              onChange={(value) => onChange({ ...props, [name]: value })}
            />
          </div>
        ))}
    </>
  );
}

/** Fields in a panel of Gutenberg's sidebar. */
export function FieldsPanel({
  title,
  fields,
  props,
  onChange,
  hidden,
  children,
}: {
  title: string;
  fields: Fields | Record<string, unknown>;
  props: Record<string, unknown>;
  onChange: (props: Record<string, unknown>) => void;
  /** Fields not to show, such as rich text edited in place on the canvas. */
  hidden?: ReadonlySet<string>;
  children?: ReactNode;
}) {
  const shown = Object.entries(fields as Record<string, Field>).filter(
    ([name, field]) => isShown(field) && !hidden?.has(name),
  );
  if (shown.length === 0 && !children) return null;
  return (
    <PanelBody title={title}>
      <FieldControls fields={fields as Record<string, Field>} props={props} onChange={onChange} hidden={hidden} />
      {children}
    </PanelBody>
  );
}

/** The block's fields in the sidebar, where Gutenberg shows the selected block's settings. */
export function BlockFields(props: {
  fields: Fields;
  props: Record<string, unknown>;
  onChange: (props: Record<string, unknown>) => void;
  hidden?: ReadonlySet<string>;
}) {
  return (
    <InspectorControls>
      <FieldsPanel title="Settings" {...props} />
    </InspectorControls>
  );
}
