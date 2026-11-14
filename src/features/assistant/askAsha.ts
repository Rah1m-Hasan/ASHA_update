import { api, type Credential } from "@/lib/api";
import { readLocal } from "@/lib/storage";
import { urgentCompanionResponse } from "../../../public/app/everyday/companion-safety.js";

export type ChatTurn = { role: "user" | "assistant"; text: string };

export type ChatReply = {
  reply: string;
  language?: string;
  proposal?: { kind: string; text: string };
  suggestedModule?: string;
  safety?: { level: string };
};

export type InterpretReply = {
  candidate: string;
  alternatives: string[];
  question: string;
  language?: string;
  safety?: { level: string };
};

type SpeechPair = { heard: string; confirmedText: string; confirmed: boolean };

export function confirmedSpeechPairs(patientId: string) {
  return readLocal<SpeechPair[]>("speech_" + patientId, [])
    .filter(
      (x) =>
        x?.confirmed === true && x.heard?.trim() && x.confirmedText?.trim(),
    )
    .slice(-20);
}

/** Sends a message to Asha (server-side model orchestration). Requires cloud consent. */
export async function askAsha(
  cred: Credential | null,
  body: {
    text: string;
    cloud: boolean;
    mode?: "chat" | "interpret";
    module?: string;
    context?: string;
    history?: ChatTurn[];
    language?: string;
    /**
     * The recogniser's other readings of the same words. These are what was
     * heard, not meanings: they never appear in the reply's `alternatives`.
     */
    heardAlternatives?: string[];
  },
) {
  // The existing precautionary response runs locally, including before linking or cloud consent.
  const urgent = urgentCompanionResponse(body.text, {
    language: body.language,
    mode: body.mode ?? "chat",
  });
  if (urgent)
    return {
      reply: "",
      candidate: "",
      alternatives: [],
      question: "",
      ...urgent,
    } as ChatReply & InterpretReply;
  if (!cred)
    throw new Error(
      "Link a caregiver first — Asha’s cloud replies use your private care circle.",
    );
  if (!body.cloud)
    throw new Error("Turn on cloud assistance in Settings so I can reply.");
  return api<ChatReply & InterpretReply>("asha", {
    cred,
    body: {
      consent: true,
      mode: body.mode ?? "chat",
      module: body.module ?? "companion",
      context: body.context ?? "",
      history: body.history?.slice(-6) ?? [],
      language: body.language ?? "auto",
      text: body.text,
      confirmedMemories:
        body.mode === "interpret" ? confirmedSpeechPairs(cred.patientId) : [],
      heardAlternatives:
        body.mode === "interpret"
          ? (body.heardAlternatives ?? [])
              .slice(0, 2)
              .map((item) => String(item ?? "").slice(0, 200))
          : [],
    },
  });
}
