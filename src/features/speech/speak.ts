import { sessionStore } from "@/features/session/store";

type Capture = { pauseForOutput(): void; resumeAfterOutput(): void };
const captures = new Set<Capture>();
let version = 0;
let speaking = false;

/** Keep every microphone quiet throughout Asha's output and its cooldown. */
export function registerSpeechCapture(capture: Capture) {
  captures.add(capture);
  if (speaking) capture.pauseForOutput();
  return () => {
    captures.delete(capture);
  };
}

export const isSpeaking = () => speaking;

/** Speaks text with the user's chosen voice. Bangla text is spoken with a Bangla voice when available. */
export function speak(
  text: string,
  { onDone, onError }: { onDone?: () => void; onError?: () => void } = {},
) {
  const v = ++version;
  speaking = true;
  captures.forEach((c) => c.pauseForOutput());
  const finish = (error = false) => {
    if (v !== version) return;
    speaking = false;
    captures.forEach((c) => c.resumeAfterOutput());
    if (error) onError?.();
    else onDone?.();
  };
  if (typeof window === "undefined" || !("speechSynthesis" in window))
    return finish();
  const { settings } = sessionStore.get();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const lang = /[ঀ-৿]/.test(text) ? "bn" : "en";
  const voices = speechSynthesis.getVoices();
  u.lang = lang === "bn" ? "bn-BD" : "en-US";
  u.voice =
    voices.find(
      (x) => x.name === settings.voice && x.lang.toLowerCase().startsWith(lang),
    ) ||
    voices.find((x) => x.lang.toLowerCase().startsWith(lang)) ||
    null;
  u.rate = settings.rate || 0.9;
  u.onend = () => finish();
  u.onerror = () => finish(true);
  try {
    speechSynthesis.speak(u);
  } catch {
    finish(true);
  }
}

export function stopSpeaking() {
  version++;
  speaking = false;
  if (typeof window !== "undefined" && "speechSynthesis" in window)
    speechSynthesis.cancel();
  captures.forEach((c) => c.resumeAfterOutput());
}
