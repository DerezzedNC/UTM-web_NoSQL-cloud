import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

type ControlProps = {
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

export function Field({ id, label, hint, error, children }: FieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const control = Children.map(children, (child) => {
    if (!isValidElement(child)) {
      return child;
    }
    return cloneElement(child as ReactElement<ControlProps>, {
      "aria-invalid": Boolean(error),
      "aria-describedby": describedBy,
    });
  });

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
      </label>
      {control}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const controlClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50";

export function inputClass(hasError?: boolean) {
  return `${controlClass} ${hasError ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100" : ""}`;
}
