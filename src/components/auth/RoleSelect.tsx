"use client";

import { HeartIcon, UsersIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { Role } from "@/features/session/types";

const roles: {
  value: Role;
  title: string;
  text: string;
  icon: typeof UsersIcon;
}[] = [
  {
    value: "caregiver",
    title: "Caregiver",
    text: "Family or care team",
    icon: UsersIcon,
  },
  {
    value: "patient",
    title: "Patient",
    text: "I’ll use Asha myself",
    icon: HeartIcon,
  },
];

export function RoleSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: Role;
  onChange: (r: Role) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="disabled:opacity-60">
      <legend className="text-sm font-medium text-ink">
        Choose a dashboard view
      </legend>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {roles.map(({ value: v, title, text, icon: Icon }) => (
          <label
            key={v}
            className={cn(
              "flex cursor-pointer flex-col gap-2 rounded-2xl border p-4 transition has-focus-visible:ring-2 has-focus-visible:ring-brand/30",
              value === v
                ? "border-brand bg-brand-soft"
                : "border-line hover:border-brand/50",
            )}
          >
            <input
              type="radio"
              name="role"
              value={v}
              checked={value === v}
              onChange={() => onChange(v)}
              className="sr-only"
            />
            <span
              className={cn(
                "grid size-8 place-items-center rounded-full",
                value === v
                  ? "bg-brand text-white"
                  : "bg-brand-soft text-brand",
              )}
            >
              <Icon size={16} />
            </span>
            <span>
              <span className="block font-medium text-ink">{title}</span>
              <span className="text-sm text-muted">{text}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
