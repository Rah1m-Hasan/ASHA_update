"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";

const input =
  "block h-12 w-full rounded-xl border bg-white px-4 text-base text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-brand/20";

type FieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  error?: string;
  hint?: React.ReactNode;
};

export function FormField({ label, error, hint, className, type, ...props }: FieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {hint}
      </div>
      <div className="relative mt-2">
        <input
          id={id}
          type={isPassword && visible ? "text" : type}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(input, error ? "border-danger focus:border-danger" : "border-line focus:border-brand", isPassword && "pr-16")}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md px-2 py-1 text-sm font-medium text-brand hover:bg-brand-soft"
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
