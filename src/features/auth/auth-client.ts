import { sessionStore } from "@/features/session/store";
import type { LoginInput, RegisterInput } from "./validation";

export type AuthResult = { ok: true; redirectTo: string } | { ok: false; error: string };

/**
 * Auth integration point. Replace these with your provider (Supabase Auth, NextAuth, etc.).
 * Until then they only validate on the client and continue to the app.
 */
export async function signIn(input: LoginInput): Promise<AuthResult> {
  void input;
  return { ok: true, redirectTo: "/dashboard" };
}

export async function signUp(input: RegisterInput): Promise<AuthResult> {
  sessionStore.setRole(input.role);
  return { ok: true, redirectTo: `/dashboard/${input.role}` };
}
