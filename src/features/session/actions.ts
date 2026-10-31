import { api } from "@/lib/api";
import type { Assessment } from "@/lib/engine/types";
import { readLocal, saveLocal } from "@/lib/storage";
import { sessionStore } from "./store";
import type { Profile, SupportContext, Voice } from "./types";

export const DEMO_ASSESSMENT: Assessment = {
  leftHand: "reliable",
  rightHand: "reliable",
  wrist: "reliable",
  fingers: "reliable",
  eyes: "reliable",
  lips: "reliable",
  head: "reliable",
  speech: "limited",
  canSee: true,
  canHear: true,
};

export const LOCAL_DEMO_PROFILE: Profile = {
  patientId: "local-demo",
  label: "Demo patient",
  assessment: DEMO_ASSESSMENT,
  supportContext: { categories: [], goals: [], note: "" },
  voice: { name: "", rate: 0.9 },
  recommendation: { primary: "facespeak", suggested: ["facespeak", "fingerspeak", "senseassist"] },
};

type CreateResult = Profile & { patientToken: string; caregiverToken: string };

/** Creates a private care circle. The caller decides which side of it this device becomes. */
export async function createCareCircle(input: {
  label: string;
  assessment: Assessment;
  supportContext?: SupportContext;
  voice?: Voice;
  as: "patient" | "caregiver" | "both";
}) {
  const d = await api<CreateResult>("session", {
    body: {
      action: "create",
      label: input.label,
      assessment: input.assessment,
      supportContext: input.supportContext ?? LOCAL_DEMO_PROFILE.supportContext,
      voice: input.voice ?? LOCAL_DEMO_PROFILE.voice,
    },
  });
  if (input.as !== "caregiver") sessionStore.setPatient({ patientId: d.patientId, token: d.patientToken });
  if (input.as !== "patient")
    sessionStore.upsertCare({ patientId: d.patientId, token: d.caregiverToken, patientToken: d.patientToken, label: d.label });
  return d;
}

/** Starts a demo care circle on this device (patient + caregiver). */
export async function startDemo() {
  const d = await createCareCircle({ label: "Demo patient", assessment: DEMO_ASSESSMENT, as: "both" });
  saveLocal("demoPatientId", d.patientId);
  return d;
}

export const isDemo = (patientId?: string | null) => !!patientId && readLocal("demoPatientId", "") === patientId;

/** Builds the private link another device opens to join as patient or caregiver. */
export function privateLink(role: "patient" | "caregiver", patientId: string, token: string) {
  const u = new URL("/dashboard/link", window.location.origin);
  u.searchParams.set("role", role);
  u.hash = new URLSearchParams({ patientId, token }).toString();
  return u.toString();
}

/** Accepts a private link (new /dashboard/link or legacy /app links). */
export function acceptLink(href: string) {
  const u = new URL(href, window.location.origin);
  const params = new URLSearchParams(u.hash.slice(1));
  const patientId = params.get("patientId") || "";
  const token = params.get("token") || "";
  const role = u.searchParams.get("role") === "caregiver" ? "caregiver" : "patient";
  if (!/^[a-f0-9]{24}$/.test(patientId) || !token) throw new Error("This link is incomplete. Copy the full private link again.");
  if (role === "patient") sessionStore.setPatient({ patientId, token });
  else sessionStore.upsertCare({ patientId, token, label: "Patient" });
  sessionStore.setRole(role);
  return role;
}
