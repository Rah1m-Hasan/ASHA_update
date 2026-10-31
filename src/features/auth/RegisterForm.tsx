"use client";

import Link from "next/link";
import { useState } from "react";
import { FormField } from "@/components/auth/FormField";
import { RoleSelect } from "@/components/auth/RoleSelect";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { signUp } from "./auth-client";
import { passwordStrength, validateRegister, type FieldErrors, type RegisterInput, type Role } from "./validation";

const strengthLabel = ["Too weak", "Weak", "Fair", "Good", "Strong"];

export function RegisterForm() {
  const [role, setRole] = useState<Role>("caregiver");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors<keyof RegisterInput>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(password);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const input: RegisterInput = {
      role,
      name: String(data.get("name") || ""),
      email: String(data.get("email") || ""),
      password,
      confirm: String(data.get("confirm") || ""),
      terms: data.get("terms") === "on",
    };
    const found = validateRegister(input);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    const res = await signUp(input);
    if (res.ok) window.location.assign(res.redirectTo);
    else {
      setFormError(res.error);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <RoleSelect value={role} onChange={setRole} />
      <FormField label="Full name" name="name" autoComplete="name" placeholder="Your name" error={errors.name} />
      <FormField label="Email" name="email" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email} />
      <div>
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        {password && (
          <div className="mt-2 flex items-center gap-3" aria-live="polite">
            <div className="flex flex-1 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < strength ? "bg-brand" : "bg-line")} />
              ))}
            </div>
            <span className="w-16 text-right text-xs text-muted">{strengthLabel[strength]}</span>
          </div>
        )}
      </div>
      <FormField label="Confirm password" name="confirm" type="password" autoComplete="new-password" error={errors.confirm} />
      <div>
        <label className="flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" name="terms" className="mt-0.5 size-4 accent-brand" aria-invalid={!!errors.terms} />
          <span>
            I agree to the terms and understand Asha is an assistive prototype, not a medical or emergency service.
          </span>
        </label>
        {errors.terms && <p className="mt-1.5 text-sm text-danger">{errors.terms}</p>}
      </div>
      {formError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      )}
      <Button type="submit" className="h-12 w-full" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
