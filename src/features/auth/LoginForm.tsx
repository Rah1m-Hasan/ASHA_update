"use client";

import Link from "next/link";
import { useState } from "react";
import { FormField } from "@/components/auth/FormField";
import { Button, buttonClass } from "@/components/ui/Button";
import { signIn } from "./auth-client";
import { validateLogin, type FieldErrors, type LoginInput } from "./validation";

export function LoginForm() {
  const [errors, setErrors] = useState<FieldErrors<keyof LoginInput>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const input = { email: String(data.get("email") || ""), password: String(data.get("password") || "") };
    const found = validateLogin(input);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    const res = await signIn(input);
    if (res.ok) window.location.assign(res.redirectTo);
    else {
      setFormError(res.error);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormField label="Email" name="email" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email} />
      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        error={errors.password}
        hint={
          <Link href="/login?reset=1" className="text-sm font-medium text-brand hover:underline">
            Forgot password?
          </Link>
        }
      />
      <label className="flex items-center gap-3 text-sm text-ink">
        <input type="checkbox" name="remember" className="size-4 accent-brand" />
        Keep me signed in on this device
      </label>
      {formError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      )}
      <Button type="submit" className="h-12 w-full" disabled={busy}>
        {busy ? "Signing in…" : "Log in"}
      </Button>
      <Divider />
      <a href="/dashboard/patient/facespeak" className={buttonClass("secondary", "md", "h-12 w-full")}>
        Explore the live demo
      </a>
      <p className="text-center text-sm text-muted">
        New to Asha?{" "}
        <Link href="/register" className="font-medium text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function Divider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted uppercase">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
