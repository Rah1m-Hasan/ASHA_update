"use client";

import { useEffect, useRef } from "react";
import { usePerceptionEvent } from "@/features/perception/PerceptionProvider";
import type { FrameLandmarks, Landmark } from "@/lib/engine/types";
import { FACE_REGIONS, HAND_EDGES, MIN_VISIBILITY, POSE_EDGES, projectPoint, relevantPoseIndices, trackingModules } from "./tracking.js";

const RELEVANT_FACE = [...FACE_REGIONS.lips, ...FACE_REGIONS.brows, ...FACE_REGIONS.cheeks];
const GUIDES: Record<string, { w: number; h: number; shape: "rect" | "oval" }> = {
  full_body: { w: 0.42, h: 0.92, shape: "rect" },
  upper_body: { w: 0.62, h: 0.86, shape: "rect" },
  face: { w: 0.34, h: 0.66, shape: "oval" },
  hand: { w: 0.3, h: 0.5, shape: "rect" },
};

/**
 * Landmarks drawn over the live video, exactly where the video shows them: the same object-fit
 * crop, the same mirroring and the device pixel ratio. By default only the points the exercise is
 * measured from; "show all" draws every landmark the models returned (never ones they didn't).
 */
export function MoveOverlay({ exerciseId, showAll, mirrored, framing, ready }: { exerciseId: string | null; showAll: boolean; mirrored: boolean; framing: string | null; ready: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef<FrameLandmarks | null>(null);
  const dirty = useRef(true);
  const opts = useRef({ exerciseId, showAll, mirrored, framing, ready });

  useEffect(() => {
    opts.current = { exerciseId, showAll, mirrored, framing, ready };
    dirty.current = true;
  }, [exerciseId, showAll, mirrored, framing, ready]);

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
      const o = opts.current;
      const f = latest.current;
      if (o.framing && GUIDES[o.framing]) guide(ctx, w, h, GUIDES[o.framing], o.ready);
      if (!f) {
        el.dataset.points = "0";
        return;
      }
      const view = { videoWidth: f.videoSize.width, videoHeight: f.videoSize.height, boxWidth: w, boxHeight: h, mirrored: o.mirrored };
      const at = (p: Landmark) => projectPoint(p, view);
      let drawn = 0;
      const dot = (p: Landmark, r: number, fill: string | null, stroke?: string) => {
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
        const q = at(p);
        ctx.beginPath();
        ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
        if (fill) (ctx.fillStyle = fill), ctx.fill();
        if (stroke) (ctx.strokeStyle = stroke), (ctx.lineWidth = 2), ctx.stroke();
        drawn++;
      };
      const line = (a: Landmark, b: Landmark, width: number, color: string) => {
        if (!a || !b) return;
        const p = at(a), q = at(b);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.stroke();
      };
      const seen = (p?: Landmark) => !!p && Math.min(p.visibility ?? 1, p.presence ?? 1) >= MIN_VISIBILITY;
      const kind = o.exerciseId ? trackingModules(o.exerciseId).kind : null;
      const fresh = (at?: number | null) => at == null || f.timestampMs - at <= 1000;

      if (o.showAll) {
        if (f.pose && fresh(f.poseAt)) {
          for (const [a, b] of POSE_EDGES) line(f.pose[a], f.pose[b], 2, "rgba(255,255,255,0.75)");
          for (const p of f.pose) dot(p, 2.5, seen(p) ? "#ffffff" : "rgba(255,180,84,0.9)");
        }
        for (const p of f.face ?? []) dot(p, 1, "rgba(177,160,255,0.85)");
        if (fresh(f.handsAt))
          for (const hand of f.hands) {
            for (const [a, b] of HAND_EDGES) line(hand.landmarks[a], hand.landmarks[b], 2, "rgba(255,203,116,0.9)");
            for (const p of hand.landmarks) dot(p, 2, "#ffcb74");
          }
      }
      if (kind === "pose" && f.pose && fresh(f.poseAt)) {
        const keep = new Set(relevantPoseIndices(o.exerciseId!));
        for (const [a, b] of POSE_EDGES) if (keep.has(a) && keep.has(b) && seen(f.pose[a]) && seen(f.pose[b])) line(f.pose[a], f.pose[b], 5, "rgba(45,212,191,0.95)");
        for (const i of keep) {
          const p = f.pose[i];
          if (seen(p)) dot(p, 6, "#2dd4bf", "#ffffff");
          else dot(p, 6, null, "#ffb454");
        }
      } else if (kind === "face" && f.face && !o.showAll) {
        for (const i of RELEVANT_FACE) dot(f.face[i], 2, "#2dd4bf");
      } else if (kind === "hands" && fresh(f.handsAt) && !o.showAll) {
        for (const hand of f.hands) {
          for (const [a, b] of HAND_EDGES) line(hand.landmarks[a], hand.landmarks[b], 3, "rgba(45,212,191,0.95)");
          for (const p of hand.landmarks) dot(p, 3.5, "#2dd4bf");
        }
      }
      el.dataset.points = String(drawn);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvas} className="pointer-events-none absolute inset-0 size-full" aria-hidden="true" data-testid="move-overlay" data-mirrored={mirrored ? "true" : "false"} />;
}

function guide(ctx: CanvasRenderingContext2D, w: number, h: number, g: { w: number; h: number; shape: "rect" | "oval" }, ready: boolean) {
  const gw = w * g.w, gh = h * g.h, x = (w - gw) / 2, y = (h - gh) / 2;
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = ready ? "rgba(45,212,191,0.95)" : "rgba(255,255,255,0.85)";
  ctx.beginPath();
  if (g.shape === "oval") ctx.ellipse(w / 2, h / 2, gw / 2, gh / 2, 0, 0, Math.PI * 2);
  else ctx.roundRect(x, y, gw, gh, 24);
  ctx.stroke();
  ctx.restore();
}
