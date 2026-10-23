"use client";

import { useState } from "react";
import { Field, inputClass } from "./Field";

type ChipInputProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  values: string[];
  placeholder?: string;
  onChange: (values: string[]) => void;
};

export function ChipInput({
  id,
  label,
  hint,
  error,
  values,
  placeholder,
  onChange,
}: ChipInputProps) {
  const [draft, setDraft] = useState("");

  function addValue() {
    const next = draft.trim();
    if (!next || values.includes(next)) {
      setDraft("");
      return;
    }
    onChange([...values, next]);
    setDraft("");
  }

  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={id}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addValue();
              }
            }}
            placeholder={placeholder}
            className={inputClass(Boolean(error))}
          />
          <button
            type="button"
            onClick={addValue}
            className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Agregar
          </button>
        </div>
        {values.length > 0 ? (
          <ul className="flex flex-wrap gap-2 pt-1">
            {values.map((value) => (
              <li
                key={value}
                className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-900"
              >
                {value}
                <button
                  type="button"
                  onClick={() =>
                    onChange(values.filter((item) => item !== value))
                  }
                  className="rounded-full px-1 text-teal-700 hover:bg-teal-100"
                  aria-label={`Quitar ${value}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Field>
  );
}
