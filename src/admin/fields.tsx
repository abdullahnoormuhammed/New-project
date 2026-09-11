import type { ReactNode } from 'react';

/** Labelled form control wrapper used throughout the admin panel. */
export function Field({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {note ? <span className="note">{note}</span> : null}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  note,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  note?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label} note={note}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  note,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  note?: string;
  rows?: number;
}) {
  return (
    <Field label={label} note={note}>
      <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  note,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  note?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <Field label={label} note={note}>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          // An empty or half-typed value must not wipe the stored number.
          if (event.target.value === '' || Number.isNaN(parsed)) return;
          onChange(parsed);
        }}
      />
    </Field>
  );
}

export function TimeField({
  label,
  value,
  onChange,
  note,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  note?: string;
}) {
  return (
    <Field label={label} note={note}>
      <input type="time" value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

export function DateField({
  label,
  value,
  onChange,
  note,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  note?: string;
}) {
  return (
    <Field label={label} note={note}>
      <input
        type="date"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
      />
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  note,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  note?: string;
}) {
  return (
    <Field label={label} note={note}>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="admin-section">
      <h2>{title}</h2>
      {hint ? <p className="hint">{hint}</p> : null}
      {children}
    </section>
  );
}

/**
 * Card wrapper for one item in an editable list, with the enable toggle,
 * reordering and delete controls that every list here needs.
 */
export function ItemCard({
  index,
  total,
  label,
  enabled,
  onToggle,
  onMove,
  onDelete,
  children,
}: {
  index: number;
  total: number;
  label: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  return (
    <div className="item-card">
      <div className="item-card-head">
        <span className="index">
          {label} {index + 1} of {total}
        </span>
        <div className="btn-row">
          <Switch label="Show on board" checked={enabled} onChange={onToggle} />
          <button className="btn" onClick={() => onMove(-1)} disabled={index === 0} type="button">
            ↑
          </button>
          <button
            className="btn"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            type="button"
          >
            ↓
          </button>
          <button className="btn btn-danger" onClick={onDelete} type="button">
            Delete
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

/** Move an item within a list, returning a new array. */
export function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
