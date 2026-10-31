import { sessionStore } from "@/features/session/store";

let version = 0;

/** Speaks text with the user's chosen voice. Bangla text is spoken with a Bangla voice when available. */
export function speak(text: string, { onDone }: { onDone?: () => void } = {}) {
  const v = ++version;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return onDone?.();
  const { settings } = sessionStore.get();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const lang = /[ঀ-৿]/.test(text) ? "bn" : "en";
  const voices = speechSynthesis.getVoices();
  u.lang = lang === "bn" ? "bn-BD" : "en-US";
  u.voice =
    voices.find((x) => x.name === settings.voice && x.lang.toLowerCase().startsWith(lang)) ||
    voices.find((x) => x.lang.toLowerCase().startsWith(lang)) ||
    null;
  u.rate = settings.rate || 0.9;
  u.onend = u.onerror = () => {
    if (v === version) onDone?.();
  };
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  version++;
  if (typeof window !== "undefined" && "speechSynthesis" in window) speechSynthesis.cancel();
}
