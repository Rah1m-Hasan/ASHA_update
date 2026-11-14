"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { engineModule } from "@/lib/engine/load";
import { isSpeaking, registerSpeechCapture } from "./speak";

type Capture = {
  start(o: { language?: string; initialText?: string }): void;
  stop(reason?: string): void;
  active: boolean;
  remainingMs: number;
  pauseForOutput(): void;
  resumeAfterOutput(): void;
};

/** What the recogniser reported alongside the words. */
type CaptureText = {
  finalText?: string;
  interimText?: string;
  /** The recogniser's other readings of the same words. */
  alternatives?: string[];
};

/** Browser speech recognition through the engine's SpeechCapture (auto-reconnect, 90 s window). */
export function useSpeechCapture() {
  const capture = useRef<Capture | null>(null);
  const [text, setText] = useState("");
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [note, setNote] = useState("");

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Recognition) {
      setSupported(false);
      return;
    }
    let alive = true;
    let unregister: (() => void) | undefined;
    void engineModule<{ SpeechCapture: new (o: unknown) => Capture }>(
      "speech-capture",
    )
      .then(({ SpeechCapture }) => {
        if (!alive) return;
        capture.current = new SpeechCapture({
          Recognition,
          onText: (t: string, info?: CaptureText) => {
            setText(t);
            setAlternatives(
              Array.isArray(info?.alternatives)
                ? info.alternatives.slice(0, 2).filter(Boolean)
                : [],
            );
          },
          onState: (s: { state: string; reason?: string }) => {
            setListening(s.state === "listening" || s.state === "paused");
            setNote(
              s.reason === "time-limit"
                ? "Listening stopped after 90 seconds."
                : s.state === "error"
                  ? "Speech recognition is not available in this browser."
                  : "",
            );
          },
        });
        unregister = registerSpeechCapture(capture.current);
      })
      .catch(() => {
        if (alive) {
          setSupported(false);
          setNote(
            "Speech recognition could not load. Type what was said instead.",
          );
        }
      });
    const pauseHidden = () => {
      if (document.hidden) capture.current?.stop("page-hidden");
    };
    const stopOnExit = () => capture.current?.stop("page-hidden");
    document.addEventListener("visibilitychange", pauseHidden);
    window.addEventListener("pagehide", stopOnExit);
    return () => {
      alive = false;
      capture.current?.stop("unmount");
      capture.current = null;
      unregister?.();
      document.removeEventListener("visibilitychange", pauseHidden);
      window.removeEventListener("pagehide", stopOnExit);
    };
  }, []);

  const start = useCallback(
    (language = "en-US") => {
      const c = capture.current;
      if (!c) return;
      // The words of this session only. Starting again used to put the
      // previous session's words in front of the new ones, so "water" and
      // then "toilet" were heard as "water toilet".
      c.start({ language });
      if (isSpeaking()) c.pauseForOutput();
      setListening(c.active);
    },
    [],
  );
  const stop = useCallback(() => {
    capture.current?.stop("stopped");
    setListening(false);
  }, []);

  return { text, setText, alternatives, listening, supported, note, start, stop };
}
