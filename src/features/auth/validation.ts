export type Role = "caregiver" | "patient";
export type FieldErrors<T extends string> = Partial<Record<T, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type LoginInput = { email: string; password: string };
export function validateLogin(v: LoginInput): FieldErrors<keyof LoginInput> {
  const e: FieldErrors<keyof LoginInput> = {};
  if (!EMAIL.test(v.email.trim())) e.email = "Enter a valid email address.";
  if (!v.password) e.password = "Enter your password.";
  return e;
}

export type RegisterInput = { role: Role; name: string; email: string; password: string; confirm: string; terms: boolean };
export function validateRegister(v: RegisterInput): FieldErrors<keyof RegisterInput> {
  const e: FieldErrors<keyof RegisterInput> = {};
  if (v.name.trim().length < 2) e.name = "Enter your name.";
  if (!EMAIL.test(v.email.trim())) e.email = "Enter a valid email address.";
  if (v.password.length < 8) e.password = "Use at least 8 characters.";
  else if (!/[A-Za-z]/.test(v.password) || !/\d/.test(v.password)) e.password = "Use letters and at least one number.";
  if (v.confirm !== v.password) e.confirm = "Passwords don’t match.";
  if (!v.terms) e.terms = "Please accept to continue.";
  return e;
}

/** 0–4 strength score for the password meter. */
export function passwordStrength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return s;
}
