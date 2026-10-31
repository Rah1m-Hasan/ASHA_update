import { api, type Credential } from "@/lib/api";
import { readLocal } from "@/lib/storage";

export type ChatTurn = { role: "user" | "assistant"; text: string };

export type ChatReply = {
  reply: string;
  language?: string;
  proposal?: { kind: string; text: string };
  suggestedModule?: string;
};

export type InterpretReply = { candidate: string; alternatives: string[]; question: string; language?: string };

type SpeechPair = { heard: string; confirmedText: string; confirmed: boolean };

export function confirmedSpeechPairs(patientId: string) {
  return readLocal<SpeechPair[]>("speech_" + patientId, [])
    .filter((x) => x?.confirmed === true && x.heard?.trim() && x.confirmedText?.trim())
    .slice(-20);
}

/** Sends a message to Asha (server-side model orchestration). Requires cloud consent. */
export function askAsha(
  cred: Credential,
  body: { text: string; mode?: "chat" | "interpret"; module?: string; context?: string; history?: ChatTurn[]; language?: string },
) {
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
      confirmedMemories: body.mode === "interpret" ? confirmedSpeechPairs(cred.patientId) : [],
    },
  });
}
