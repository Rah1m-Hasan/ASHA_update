import type { Assessment } from "@/lib/engine/types";

export const ABILITY_FIELDS: { key: keyof Omit<Assessment, "canSee" | "canHear">; label: string; group: string }[] = [
  { key: "eyes", label: "Eyes and blinking", group: "Face" },
  { key: "lips", label: "Lips and smile", group: "Face" },
  { key: "head", label: "Head movement", group: "Face" },
  { key: "leftHand", label: "Left hand", group: "Hands" },
  { key: "rightHand", label: "Right hand", group: "Hands" },
  { key: "wrist", label: "Wrist", group: "Hands" },
  { key: "fingers", label: "Fingers", group: "Hands" },
  { key: "speech", label: "Speech", group: "Voice" },
];

export const LEVELS = [
  { value: "none", label: "Not available" },
  { value: "limited", label: "Limited" },
  { value: "reliable", label: "Reliable" },
] as const;

export const EMPTY_ASSESSMENT: Assessment = {
  eyes: "none",
  lips: "none",
  head: "none",
  leftHand: "none",
  rightHand: "none",
  wrist: "none",
  fingers: "none",
  speech: "none",
  canSee: true,
  canHear: true,
};

export const SUPPORT_OPTIONS = [
  ["injury", "Voice loss after an accident or injury"],
  ["als", "ALS / motor neuron condition"],
  ["stroke", "Post-stroke recovery"],
  ["cerebral-palsy", "Cerebral palsy"],
  ["older-adult", "Older adult support"],
  ["locked-in", "Locked-in syndrome"],
  ["autism", "Autism / different communication needs"],
  ["temporary", "Temporary voice loss / surgery recovery"],
  ["other", "Another reason"],
] as const;

export const SUPPORT_GOALS = [
  ["needs", "Express everyday needs"],
  ["speech", "Practise or clarify speech"],
  ["companion", "Companionship and daily support"],
  ["care", "Stay connected to a caregiver"],
] as const;

/** Mirrors the server's recommendation so the caregiver sees it before saving. */
export function recommend(a: Assessment) {
  const list: string[] = [];
  if (a.fingers !== "none" && (a.leftHand !== "none" || a.rightHand !== "none")) list.push("FingerSpeak");
  if (["eyes", "lips", "head"].some((k) => a[k as keyof Assessment] !== "none")) list.push("FaceSpeak");
  if (a.speech !== "none") list.push("SenseAssist");
  return list;
}
