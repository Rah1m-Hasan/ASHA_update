// What the eye cursor can click on the page right now, and how it clicks it.

import { activeDialog } from "@/lib/dialog";

export type Target = { id: string; el: HTMLElement; x: number; y: number; w: number; h: number; label?: string };

const CLICKABLE = [
  "a[href]",
  "button",
  "input:not([type=hidden])",
  "select",
  "textarea",
  "summary",
  "label",
  "[role=button]",
  "[role=link]",
  "[role=switch]",
  "[role=tab]",
  "[role=checkbox]",
  "[role=radio]",
  "[role=menuitem]",
  "[role=option]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const ids = new WeakMap<HTMLElement, string>();
let nextId = 0;
const idOf = (el: HTMLElement) => {
  let id = ids.get(el);
  if (!id) ids.set(el, (id = `t${++nextId}`));
  return id;
};

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const clip = (s: string, n = 44) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

/** Visible text, a line per block, leaving out what screen readers skip (icons, emoji art). */
function readable(el: Element): string {
  let out = "";
  for (const n of el.childNodes) {
    if (n.nodeType === Node.TEXT_NODE) out += n.textContent ?? "";
    else if (n instanceof Element) {
      if (n.getAttribute("aria-hidden") === "true" || n.tagName.toLowerCase() === "svg") continue;
      const display = getComputedStyle(n).display;
      const inner = readable(n);
      out += display === "none" ? "" : display.startsWith("inline") || display === "contents" ? inner : `\n${inner}\n`;
    }
  }
  return out;
}

/** A short name for a clickable element, as a screen reader would say it. */
export function labelOf(el: HTMLElement): string {
  const aria = clean(el.getAttribute("aria-label"));
  if (aria) return clip(aria);
  const by = el.getAttribute("aria-labelledby");
  if (by) {
    const text = clean(by.split(/\s+/).map((id) => document.getElementById(id)?.innerText ?? "").join(" "));
    if (text) return clip(text);
  }
  // The first line only: a switch's label holds its title and then a longer description.
  const line = readable(el).split("\n").map(clean).find(Boolean);
  if (line) return clip(line);
  const other = clean(el.getAttribute("title")) || clean(el.querySelector("img")?.getAttribute("alt")) || clean((el as HTMLInputElement).placeholder) || clean((el as HTMLInputElement).value);
  if (other) return clip(other);
  return el.tagName === "A" ? "Link" : "Button";
}

/**
 * Every clickable thing that is on screen, enabled and not covered by something else. While a
 * dialog is open only its contents count, as for a mouse. Inputs inside a label count as the label
 * (switches here hide the real checkbox inside one).
 */
export function collectTargets(): Target[] {
  const W = innerWidth, H = innerHeight;
  const scope: ParentNode = activeDialog() ?? document;
  const out: Target[] = [];
  const seen = new Set<HTMLElement>();
  const boxes: { el: HTMLElement; r: DOMRect }[] = [];
  for (const found of scope.querySelectorAll<HTMLElement>(CLICKABLE)) {
    let el = found;
    if (el.closest("[data-gaze-ignore]")) continue;
    if (el.matches("input,select,textarea")) el = el.closest("label") ?? el;
    if (el instanceof HTMLLabelElement && !el.control) continue;
    if (seen.has(el)) continue;
    seen.add(el);
    if (el.matches(":disabled") || el.getAttribute("aria-disabled") === "true" || el.closest("[inert],[aria-hidden=true]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6) continue;
    boxes.push({ el, r });
  }
  // Every rectangle is read before anything is hit-tested, so the page is laid out once rather
  // than once per button.
  for (const { el, r } of boxes) {
    const left = Math.max(0, r.left), right = Math.min(W, r.right), top = Math.max(0, r.top), bottom = Math.min(H, r.bottom);
    if (right - left < 6 || bottom - top < 6) continue;
    const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
    if (!hit || !(hit === el || el.contains(hit))) continue;
    out.push({ id: idOf(el), el, x: left / W, y: top / H, w: (right - left) / W, h: (bottom - top) / H });
  }
  return out;
}

/** Click as a mouse would. Text fields are focused, not clicked, so a keyboard can type there. */
export function press(el: HTMLElement) {
  if (!el.isConnected) return;
  el.focus({ preventScroll: true });
  if (el.matches("textarea, select, input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=reset])")) return;
  el.click();
}
