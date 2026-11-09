"use client";

// Clinician programs come only from the ASHA Clinic API, where the server checks the invitation,
// the role and the patient's "move" sharing consent on every read. Nothing here trusts a local file.
import { clinicCredentials, clinicMovePlan } from "../../../public/app/everyday/clinic.js";
import { importClinicianProgram } from "./catalog.js";
import type { Program } from "./store";

const SESSION_KEY = "asha.everyday.clinic.session.v1";
export type ClinicAccess = { tenant: string; token: string; role: "admin" | "clinician" | "patient"; patientId?: string };
export type ClinicPlan = Record<string, unknown> & { id: string; exerciseId: string; clinicianName?: string; at: string; notes?: string };
export type ClinicRead = {
  name?: string;
  role: ClinicAccess["role"];
  patientId?: string;
  patients: { patientId: string; grant: { modules: string[]; expiresAt: string } | null; plans: ClinicPlan[] }[];
};

/** Read the private invitation from a pasted link (…#clinic=…) or a JSON credential. */
export function parseInvitation(text: string): ClinicAccess {
  const raw = text.trim();
  const hash = raw.includes("#clinic=") ? raw.slice(raw.indexOf("#clinic=") + "#clinic=".length) : raw;
  let value: unknown;
  try {
    value = JSON.parse(decodeURIComponent(hash));
  } catch {
    throw new Error("Paste the private invitation link your clinic sent you.");
  }
  return clinicCredentials(value) as ClinicAccess;
}

export function savedAccess(): ClinicAccess | null {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    return saved ? (clinicCredentials(JSON.parse(saved)) as ClinicAccess) : null;
  } catch {
    return null;
  }
}

/** Same tab-scoped storage the Clinic workspace uses, so one invitation works in both. */
export function rememberAccess(access: ClinicAccess | null) {
  try {
    if (access) sessionStorage.setItem(SESSION_KEY, JSON.stringify(access));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* keep it in memory for this view */
  }
}

export async function readClinic(access: ClinicAccess): Promise<ClinicRead> {
  const response = await fetch("/api/clinic", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${access.token}` },
    body: JSON.stringify({ action: "read", tenant: access.tenant }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The clinic couldn't be reached. Try again.");
  return result as ClinicRead;
}

/** Turn a Clinic plan record into a locked Move program, keeping the clinician's own angles. */
export function toProgram(plan: ClinicPlan, tenant: string): Program {
  return importClinicianProgram(clinicMovePlan(plan, tenant)) as Program;
}
