"use client";
import { Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface PickerOption {
  id: string;
  label: string;
}

/**
 * Combobox for the sub-contract of a time entry: one field that shows the chosen line, filters
 * the list as you type, and closes on a click. The value travels in a hidden input under `name`.
 */
export function SubContractPicker({ name, options, defaultValue, id, required }: { name: string; options: PickerOption[]; defaultValue?: string; id?: string; required?: boolean }) {
  const t = useTranslations("hours");
  const initial = options.find((o) => o.id === defaultValue);
  const [value, setValue] = React.useState(initial?.id ?? "");
  const [text, setText] = React.useState(initial?.label ?? "");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const root = React.useRef<HTMLDivElement>(null);
  const chosen = options.find((o) => o.id === value);
  const filtered = !open || text === chosen?.label ? options : options.filter((o) => o.label.toLowerCase().includes(text.trim().toLowerCase()));

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  });

  const close = () => {
    setOpen(false);
    setText(chosen?.label ?? "");
  };
  const choose = (o: PickerOption) => {
    setValue(o.id);
    setText(o.label);
    setOpen(false);
  };
  return (
    <div ref={root} className="relative">
      <input type="hidden" name={name} value={value} />
      <div className="relative">
        <input
          id={id}
          value={text}
          required={required && !value}
          placeholder={t("search_sub_contract")}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id ?? name}-list`}
          autoComplete="off"
          className="h-10 w-full rounded-md border border-input bg-card pe-9 ps-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
            if (value && e.target.value !== chosen?.label) setValue("");
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              if (filtered[active]) choose(filtered[active]);
            } else if (e.key === "Escape") close();
          }}
        />
        <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      </div>
      {open ? (
        <ul id={`${id ?? name}-list`} role="listbox" className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-md">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">{t("no_sub_contract_match")}</li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o.id}
                role="option"
                aria-selected={o.id === value}
                className={cn("flex cursor-pointer items-center justify-between gap-2 rounded-sm px-3 py-2 text-sm", i === active && "bg-muted", o.id === value && "font-medium")}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
              >
                <span>{o.label}</span>
                {o.id === value ? <Check className="h-4 w-4 text-primary" aria-hidden /> : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
