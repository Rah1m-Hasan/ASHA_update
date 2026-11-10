"use client";

import { useEffect, useRef } from "react";
import { projectPoint } from "@/features/move/tracking.js";
import { usePerceptionEvent } from "@/features/perception/PerceptionProvider";
import type { FrameLandmarks, Landmark } from "@/lib/engine/types";

// Face-mesh indices: each eye's outline, and the iris centre plus its four edge points.
const RIGHT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const LEFT_EYE = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
const IRISES = [
  [468, 469, 470, 471, 472],
  [473, 474, 475, 476, 477],
];

/** Draws exactly what the face model found: both eye outlines and the irises, over the live video. */
export function EyeOverlay({ mirrored }: { mirrored: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef<FrameLandmarks | null>(null);
  const dirty = useRef(true);
  const mirror = useRef(mirrored);

  useEffect(() => {
    mirror.current = mirrored;
    dirty.current = true;
  }, [mirrored]);

  usePerceptionEvent<FrameLandmarks>("landmarks", (f) => {
    latest.current = f;
    dirty.current = true;
  });

  useEffect(() => {
    let raf = 0;
    let lastSize = "";
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const el = canvas.current;
      if (!el) return;
      const dpr = window.devicePixelRatio || 1;
      const w = el.clientWidth, h = el.clientHeight;
      const size = `${w}x${h}x${dpr}`;
      if (size !== lastSize) {
        lastSize = size;
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
        dirty.current = true;
      }
      if (!dirty.current) return;
      dirty.current = false;
      const ctx = el.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const f = latest.current;
      const face = f?.face;
      // Stale frames (camera paused, face lost) are not drawn.
      if (!f || !face || face.length < 478 || performance.now() - f.timestampMs > 1000) {
        el.dataset.irises = "0";
        return;
      }
      const view = { videoWidth: f.videoSize.width, videoHeight: f.videoSize.height, boxWidth: w, boxHeight: h, mirrored: mirror.current };
      const at = (p: Landmark) => projectPoint(p, view);
      for (const eye of [RIGHT_EYE, LEFT_EYE]) {
        ctx.beginPath();
        eye.forEach((i, n) => {
          const q = at(face[i]);
          if (n === 0) ctx.moveTo(q.x, q.y);
          else ctx.lineTo(q.x, q.y);
        });
        ctx.closePath();
        ctx.strokeStyle = "rgba(45,212,191,0.95)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      for (const [centre, ...ring] of IRISES) {
        const c = at(face[centre]);
        const r = ring.reduce((sum, i) => {
          const q = at(face[i]);
          return sum + Math.hypot(q.x - c.x, q.y - c.y);
        }, 0) / ring.length;
        ctx.beginPath();
        ctx.arc(c.x, c.y, Math.max(2, r), 0, Math.PI * 2);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(c.x, c.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffcb74";
        ctx.fill();
      }
      el.dataset.irises = "2";
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvas} data-testid="eye-overlay" className="pointer-events-none absolute inset-0 size-full" aria-hidden="true" />;
}
