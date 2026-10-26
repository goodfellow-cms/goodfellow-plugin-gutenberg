/**
 * A block's settings in Gutenberg's sidebar, from the fields in the site's
 * description: the plugin has no code of the site's to draw them with, so
 * each field type the description names gets Gutenberg's own control.
 */
import type { SiteDescription } from "@goodfellow-cms/core";
import { InspectorControls } from "@wordpress/block-editor";
import { PanelBody, RadioControl, SelectControl, TextareaControl, TextControl } from "@wordpress/components";

/** A field as the site's description has it: Puck's field, as JSON. */
export interface Field {
  type: string;
  label?: string;
  options?: Option[];
}

type Fields = SiteDescription["blocks"][string]["fields"];

interface Option {
  value: unknown;
  label: string;
}

/** The field types drawn here; the rest (rich text, lists, slots, the site's own) aren't yet. */
export const EDITABLE_TYPES = ["text", "textarea", "select", "radio", "number"];

function options(field: Field): Option[] {
  return (field.options ?? []).map(({ value, label }) => ({ value, label }));
}

/** Options' values as Gutenberg's controls hold them, which is text, and back. */
function optionValue(field: Field, text: string): unknown {
  return options(field).find((option) => String(option.value) === text)?.value ?? text;
}

function FieldControl({
  name,
  field,
  value,
  onChange,
}: {
  name: string;
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = field.label ?? name;
  const shared = { label, __nextHasNoMarginBottom: true };
  switch (field.type) {
    case "text":
      return <TextControl {...shared} __next40pxDefaultSize value={String(value ?? "")} onChange={onChange} />;
    case "number":
      return (
        <TextControl
          {...shared}
          __next40pxDefaultSize
          type="number"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(text) => onChange(text === "" ? undefined : Number(text))}
        />
      );
    case "textarea":
      return <TextareaControl {...shared} value={String(value ?? "")} onChange={onChange} />;
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
    default:
      return null;
  }
}

/** The block's fields in the sidebar, changing its `props` one at a time. */
export function BlockFields({
  fields,
  props,
  onChange,
}: {
  fields: Fields;
  props: Record<string, unknown>;
  onChange: (props: Record<string, unknown>) => void;
}) {
  const shown = (Object.entries(fields) as [string, Field][]).filter(([, field]) =>
    EDITABLE_TYPES.includes(field.type),
  );
  if (shown.length === 0) return null;
  return (
    <InspectorControls>
      <PanelBody title="Settings">
        {shown.map(([name, field]) => (
          <FieldControl
            key={name}
            name={name}
            field={field}
            value={props[name]}
            onChange={(value) => onChange({ ...props, [name]: value })}
          />
        ))}
      </PanelBody>
    </InspectorControls>
  );
}
