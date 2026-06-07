"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";

type Option = { value: string; label: string; disabled?: boolean };

// Mirrors the shape existing call sites read off a native <select> onChange:
// `onChange={(event) => doSomething(event.target.value)}`.
type SelectChangeEvent = { target: { value: string } };

export type SelectProps = {
  name?: string;
  value?: string;
  defaultValue?: string | number | readonly string[];
  onChange?: (event: SelectChangeEvent) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
  children?: ReactNode;
  id?: string;
  "aria-label"?: string;
};

function flattenText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (isValidElement(node)) return flattenText((node.props as { children?: ReactNode }).children);
  return "";
}

function extractOptions(children: ReactNode): Option[] {
  const out: Option[] = [];
  Children.toArray(children).forEach((child) => {
    if (!isValidElement(child) || child.type !== "option") return;
    const props = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
    const label = flattenText(props.children);
    const value = props.value !== undefined ? String(props.value) : label;
    out.push({ value, label, disabled: props.disabled });
  });
  return out;
}

/**
 * Drop-in replacement for a native <select> that adds type-to-search.
 * Accepts the same `<option>` children and `name`/`value`/`defaultValue`/
 * `onChange`/`disabled` props, so existing forms keep working unchanged.
 * The chosen value is mirrored into a hidden input so Server Action FormData
 * submission is preserved.
 */
export function Select({
  name,
  value,
  defaultValue,
  onChange,
  disabled = false,
  required,
  className,
  placeholder = "Select…",
  children,
  id,
  "aria-label": ariaLabel,
}: SelectProps) {
  const options = useMemo(() => extractOptions(children), [children]);

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string>(() => {
    if (value !== undefined) return value;
    if (defaultValue !== undefined) return String(defaultValue);
    return "";
  });
  const selected = isControlled ? value : internal;

  // If the selected value isn't among the current options (e.g. cascading
  // lists changed), fall back to the first option like a native <select>.
  const effective = useMemo(() => {
    if (options.some((o) => o.value === selected)) return selected;
    return options[0]?.value ?? "";
  }, [options, selected]);

  const selectedLabel = options.find((o) => o.value === effective)?.label ?? "";

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listboxId = useId();

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const node = listRef.current.querySelector<HTMLElement>(`[data-index="${active}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(option: Option) {
    if (option.disabled) return;
    if (!isControlled) setInternal(option.value);
    onChange?.({ target: { value: option.value } });
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[active];
      if (option) choose(option);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {name ? <input type="hidden" name={name} value={effective} disabled={disabled} /> : null}

      <button
        type="button"
        id={id}
        role="combobox"
        aria-label={ariaLabel}
        aria-required={required}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 text-left text-sm text-slate-950 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200",
          disabled && "cursor-not-allowed bg-slate-50 text-slate-400",
        )}
      >
        <span className={cn("truncate", !selectedLabel && "text-slate-400")}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-2.5">
            <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search…"
              className="h-9 w-full min-w-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
            />
          </div>
          <div ref={listRef} id={listboxId} role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-400">No matches</p>
            ) : (
              filtered.map((option, index) => {
                const isSelected = option.value === effective;
                const isActive = index === active;
                return (
                  <button
                    key={`${option.value}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-index={index}
                    disabled={option.disabled}
                    onClick={() => choose(option)}
                    onMouseEnter={() => setActive(index)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700",
                      isActive && "bg-slate-100",
                      isSelected && "font-medium text-slate-950",
                      option.disabled && "cursor-not-allowed text-slate-300",
                    )}
                  >
                    <span className="truncate">{option.label || " "}</span>
                    {isSelected ? <Check className="h-4 w-4 shrink-0 text-slate-900" aria-hidden="true" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
