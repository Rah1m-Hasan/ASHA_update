"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { PlayIcon, SignalIcon } from "./icons";

type VideoFrameProps = {
  /** Video file URL. Leave empty until the video is ready — the poster placeholder is shown. */
  src?: string;
  /** Poster image. When omitted, a branded placeholder with the Asha avatar is shown. */
  poster?: string;
  posterAlt: string;
  label?: string;
  duration?: string;
  /** "click": poster + play button (hero demo). "ambient": muted autoplay loop (feature clips). */
  mode?: "click" | "ambient";
  className?: string;
};

export function VideoFrame({
  src,
  poster,
  posterAlt,
  label,
  duration,
  mode = "click",
  className,
}: VideoFrameProps) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const frame = cn(
    "relative aspect-video w-full overflow-hidden rounded-[28px] bg-brand-soft shadow-float ring-1 ring-line/60",
    className,
  );

  if (src && mode === "ambient")
    return (
      <div className={frame}>
        <video className="size-full object-cover" src={src} poster={poster} autoPlay muted loop playsInline>
          {posterAlt}
        </video>
      </div>
    );

  return (
    <div className={frame}>
      {src && playing ? (
        <video ref={video} className="size-full object-cover" src={src} poster={poster} controls autoPlay playsInline>
          Your browser does not support embedded video.
        </video>
      ) : (
        <button
          type="button"
          className="group absolute inset-0 text-on-scrim disabled:cursor-default"
          onClick={() => setPlaying(true)}
          disabled={!src}
          aria-label={src ? `Play: ${label ?? posterAlt}` : posterAlt}
        >
          {poster ? (
            <Image src={poster} alt={posterAlt} fill sizes="(max-width: 768px) 100vw, 900px" className="object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center bg-brand-soft">
              <span className="grid size-24 place-items-center rounded-[28px] border border-brand/20 bg-surface text-brand shadow-panel sm:size-32">
                <SignalIcon size={56} />
              </span>
            </span>
          )}
          {poster && <span className="absolute inset-0 bg-gradient-to-t from-scrim/50 via-transparent to-transparent" />}
          {label && (
            <span className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-scrim/75 py-2 pr-5 pl-2 whitespace-nowrap backdrop-blur-md transition group-enabled:group-hover:bg-scrim/90 sm:bottom-8">
              <span className="grid size-10 place-items-center rounded-full bg-surface text-brand">
                <PlayIcon />
              </span>
              <span className="text-left leading-tight">
                <span className="block font-medium">{label}</span>
                <span className="block text-sm text-on-scrim/80">{src ? duration : "Video coming soon"}</span>
              </span>
            </span>
          )}
        </button>
      )}
    </div>
  );
}
