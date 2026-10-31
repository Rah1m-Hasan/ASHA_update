"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { engineModule } from "@/lib/engine/load";

type Capture = {
  start(o: { language?: string; initialText?: string }): void;
  stop(reason?: string): void;
  active: boolean;
  remainingMs: number;
};

/** Browser speech recognition through the engine's SpeechCapture (auto-reconnect, 90 s window). */
export function useSpeechCapture() {
  const capture = useRef<Capture | null>(null);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [note, setNote] = useState("");

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Recognition) {
      setSupported(false);
      return;
    }
    let alive = true;
    void engineModule<{ SpeechCapture: new (o: unknown) => Capture }>("speech-capture").then(({ SpeechCapture }) => {
      if (!alive) return;
      capture.current = new SpeechCapture({
        Recognition,
        onText: (t: string) => setText(t),
        onState: (s: { state: string; reason?: string }) => {
          setListening(s.state === "listening" || s.state === "paused");
          setNote(
            s.state === "stopped" && s.reason === "time-limit"
              ? "Listening stopped after 90 seconds."
              : s.state === "error"
                ? "Speech recognition is not available in this browser."
                : "",
          );
        },
      });
    });
    return () => {
      alive = false;
      capture.current?.stop("unmount");
    };
  }, []);

  const start = useCallback((language = "en-US") => {
    capture.current?.start({ language, initialText: "" });
    setListening(true);
  }, []);
  const stop = useCallback(() => {
    capture.current?.stop("stopped");
    setListening(false);
  }, []);

  return { text, setText, listening, supported, note, start, stop };
}
