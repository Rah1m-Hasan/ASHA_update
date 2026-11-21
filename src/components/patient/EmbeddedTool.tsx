"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "@/features/session/store";

// EyeSpeak and the Care journal are complete tools in the Everyday app (public/app/everyday).
// They open here inside the dashboard, without the Everyday menus, so there is one Asha to
// learn. The framed page reports its height and its notices, so it reads as part of this page.

type Route = "eyespeak" | "care";

export function EmbeddedTool({ route, title }: { route: Route; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const language = useSession((s) => s.settings.language);
  const [src, setSrc] = useState<string | null>(null);
  const [height, setHeight] = useState(720);
  const [notice, setNotice] = useState("");

  // Chosen after mount so the frame loads once, with the person's own language setting.
  useEffect(() => {
    const lang = language === "bn" || language === "en" ? `&lang=${language}` : "";
    setSrc(`/everyday.html?embed=1${lang}#${route}`);
  }, [language, route]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      const data = e.data as { type?: string; height?: unknown; text?: unknown } | null;
      if (data?.type === "asha-embed-height") {
        const h = Number(data.height);
        if (Number.isFinite(h) && h > 0) setHeight(Math.min(Math.ceil(h), 20000));
      } else if (data?.type === "asha-embed-notice" && typeof data.text === "string") {
        setNotice(data.text.slice(0, 300));
        clearTimeout(timer);
        timer = setTimeout(() => setNotice(""), 5000);
      }
    };
    addEventListener("message", onMessage);
    return () => {
      removeEventListener("message", onMessage);
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      {src ? (
        <iframe
          ref={frame}
          title={title}
          src={src}
          allow="camera; microphone; autoplay"
          className="block w-full border-0 bg-transparent"
          style={{ height, colorScheme: "light" }}
        />
      ) : (
        <div style={{ height }} aria-hidden="true" />
      )}
      <p role="status" aria-live="polite" className={notice ? "fixed inset-x-4 bottom-4 z-40 mx-auto w-fit max-w-[min(92vw,480px)] rounded-full bg-heading px-4 py-2 text-center text-sm text-canvas shadow-float" : "sr-only"}>
        {notice}
      </p>
    </>
  );
}
