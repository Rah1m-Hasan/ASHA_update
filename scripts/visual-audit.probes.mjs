// Browser-side detectors for the visual audit, injected with page.evaluate.
//
// This is a string rather than a function on purpose: it runs inside the page,
// where it can read the real computed styles and layout boxes.
//
// Every detector returns findings instead of throwing, so one broken detector
// never loses the whole page's report.

export const PROBE_SOURCE = `(() => {
  const doc = document.documentElement;
  const vw = window.innerWidth;
  const findings = [];
  const push = (type, detail) => findings.push({ type, ...detail });
  const describe = (el) => {
    const id = el.id ? "#" + el.id : "";
    const cls = el.classList && el.classList.length ? "." + [...el.classList].join(".") : "";
    return el.tagName.toLowerCase() + id + cls;
  };
  const label = (el) => (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 60);
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
  };

  // Tailwind's \`sr-only\` (and the same pattern written by hand) clips an
  // element to 1x1 so it reaches a screen reader and nothing else. It is
  // clipped on purpose, so it is never a clipping, contrast or size defect.
  const srOnly = (el) => {
    const cs = getComputedStyle(el);
    if (cs.clip && cs.clip !== "auto" && !/rect\\(0px, 0px, 0px, 0px\\)/.test(cs.clip)) return false;
    const r = el.getBoundingClientRect();
    return (r.width <= 1 && r.height <= 1) || cs.clip === "rect(0px, 0px, 0px, 0px)";
  };

  // An element inside a horizontal scroller is allowed to be wider than the
  // viewport, so the Move tab strip and the Everyday chip nav are not false
  // positives for the offender check.
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== doc; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === "auto" || ox === "scroll" || ox === "hidden") return true;
    }
    return false;
  };

  // 1. The page itself scrolls sideways.
  const overflow = doc.scrollWidth - vw;
  if (overflow > 1) push("pageOverflow", { amount: Math.round(overflow) });

  const all = Array.from(document.body.querySelectorAll("*"));

  // 2. An element crosses the viewport edge and nothing is scrolling it.
  // An element parked entirely outside the viewport (the assistive app's
  // off-screen capture canvas) is deliberate, not a defect.
  for (const el of all) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right <= 0 || r.left >= vw) continue;
    if (r.right > vw + 1 || r.left < -1) {
      if (!inScroller(el)) {
        push("offender", {
          el: describe(el),
          left: Math.round(r.left),
          right: Math.round(r.right),
          text: label(el),
        });
      }
    }
  }

  // 3. Text is clipped by an overflow:hidden box and cannot be reached.
  // Both axes count: a nowrap label inside a fixed-width box is cut off
  // horizontally even though nothing is hidden below the fold.
  //
  // Only *visible* overflowing content counts. A banner parked outside its
  // frame with transform and opacity 0 is waiting to be shown; it is not
  // clipping anything.
  for (const el of all) {
    const cs = getComputedStyle(el);
    const clipsY = cs.overflowY === "hidden" || cs.overflow === "hidden";
    const clipsX = cs.overflowX === "hidden" || cs.overflow === "hidden";
    if (!clipsY && !clipsX) continue;
    const hiddenY = el.scrollHeight - el.clientHeight;
    const hiddenX = el.scrollWidth - el.clientWidth;
    if (hiddenY <= 1 && hiddenX <= 1) continue;
    if (!el.textContent || !el.textContent.trim()) continue;
    if (!visible(el)) continue;
    if (srOnly(el)) continue;
    const box = el.getBoundingClientRect();
    let visibleOverflow = false;
    for (const ch of el.children) {
      const r = ch.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const ccs = getComputedStyle(ch);
      if (ccs.opacity === "0" || ccs.visibility === "hidden" || ccs.display === "none") continue;
      if (r.bottom > box.bottom + 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.left < box.left - 1) {
        visibleOverflow = true;
        break;
      }
    }
    if (!visibleOverflow) continue;
    push("clipped", {
      el: describe(el),
      hiddenY: Math.round(hiddenY),
      hiddenX: Math.round(hiddenX),
      text: label(el),
    });
  }

  // 4. Two interactive controls sit on top of each other.
  const controls = Array.from(document.querySelectorAll(
    'a[href], button, input, select, textarea, [role="button"], [role="tab"], [role="menuitem"], [onclick]'
  )).filter(visible);
  for (let i = 0; i < controls.length; i++) {
    for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i];
      const b = controls[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > 4 && oy > 4) {
        push("overlap", {
          a: describe(a),
          b: describe(b),
          overlap: [Math.round(ox), Math.round(oy)],
          text: label(a),
        });
      }
    }
  }

  // 5. A control smaller than 24x24 (WCAG 2.5.8 AA).
  // An element with no rendered size is not a target at all, and a
  // screen-reader-only control is never pointed at.
  for (const el of controls) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (srOnly(el)) continue;
    if (r.width < 24 || r.height < 24) {
      push("tinyTarget", {
        el: describe(el),
        size: [Math.round(r.width), Math.round(r.height)],
        text: label(el),
      });
    }
  }

  // 6. A control with no accessible name.
  const accName = (el) => {
    const aria = el.getAttribute("aria-label");
    if (aria && aria.trim()) return aria.trim();
    const ids = el.getAttribute("aria-labelledby");
    if (ids) {
      const t = ids.split(/\\s+/).map((id) => {
        const n = document.getElementById(id);
        return n ? n.textContent || "" : "";
      }).join(" ").trim();
      if (t) return t;
    }
    if (el.labels && el.labels.length) {
      const t = Array.from(el.labels).map((l) => l.textContent || "").join(" ").trim();
      if (t) return t;
    }
    const alt = el.getAttribute("alt");
    if (alt && alt.trim()) return alt.trim();
    const title = el.getAttribute("title");
    if (title && title.trim()) return title.trim();
    return (el.innerText || el.textContent || "").trim();
  };
  for (const el of controls) {
    // An element hidden from the accessibility tree needs no name.
    if (el.getAttribute("aria-hidden") === "true") continue;
    if (srOnly(el)) continue;
    if (!accName(el)) push("missingName", { el: describe(el), text: label(el) });
  }

  // 7. Heading structure.
  const heads = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter(visible);
  if (!heads.some((h) => h.tagName === "H1")) {
    push("heading", { el: "h1", text: "no visible h1" });
  }
  let prev = 0;
  for (const h of heads) {
    const lvl = Number(h.tagName[1]);
    if (prev && lvl > prev + 1) {
      push("heading", { el: describe(h), text: "h" + prev + " jumps to h" + lvl });
    }
    prev = lvl;
  }

  // 8. Text contrast against the nearest painted background.
  //
  // Colours are normalised by painting them on a canvas and reading the
  // pixel back, rather than by parsing the string: Tailwind v4 emits
  // \`color-mix(...)\`, which the browser computes in oklab or srgb with
  // 0-1 channels. A hand-written regex reads white as near-black, and every
  // ratio computed from it is wrong.
  const cvs = document.createElement("canvas");
  cvs.width = 1;
  cvs.height = 1;
  const cctx = cvs.getContext("2d", { willReadFrequently: true });
  const norm = (c) => {
    if (!c || c === "transparent") return null;
    cctx.clearRect(0, 0, 1, 1);
    cctx.fillStyle = "#000000";
    cctx.fillStyle = c;
    cctx.fillRect(0, 0, 1, 1);
    const d = cctx.getImageData(0, 0, 1, 1).data;
    if (d[3] === 0) return null;
    return { rgb: [d[0], d[1], d[2]], a: d[3] / 255 };
  };
  const blend = (fg, bg, a) => fg.map((v, i) => v * a + bg[i] * (1 - a));
  // The background is the stack of painted backgrounds from the element up,
  // composited from the bottom up, so a translucent surface is measured
  // against what is actually behind it.
  //
  // A background *image* (a gradient, a photo) has no single colour, so a
  // ratio cannot be computed from the style alone. Those elements are counted
  // as unmeasurable rather than guessed at.
  const bgOf = (el) => {
    const layers = [];
    let node = el;
    while (node && node !== doc) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== "none") return null;
      const c = norm(cs.backgroundColor);
      if (c && c.a > 0) {
        layers.push(c);
        if (c.a >= 1) break;
      }
      node = node.parentElement;
    }
    const bodyBg = norm(getComputedStyle(document.body).backgroundColor);
    layers.push(bodyBg && bodyBg.a >= 1 ? bodyBg : { rgb: [255, 255, 255], a: 1 });
    let out = layers[layers.length - 1].rgb;
    for (let i = layers.length - 2; i >= 0; i--) out = blend(layers[i].rgb, out, layers[i].a);
    return out;
  };
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const l1 = lum(a);
    const l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const seen = new Set();
  let unmeasurable = 0;
  for (const el of all) {
    if (!visible(el)) continue;
    const direct = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!direct) continue;
    const cs = getComputedStyle(el);
    const fg = norm(cs.color);
    if (!fg || fg.a === 0) continue;
    const bg = bgOf(el);
    if (!bg) {
      unmeasurable++;
      continue;
    }
    const fgFlat = fg.a < 1 ? blend(fg.rgb, bg, fg.a) : fg.rgb;
    const size = parseFloat(cs.fontSize);
    const bold = Number(cs.fontWeight) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const need = large ? 3 : 4.5;
    const r = ratio(fgFlat, bg);
    if (r < need) {
      const key = describe(el) + "|" + cs.color;
      if (seen.has(key)) continue;
      seen.add(key);
      push("contrast", {
        el: describe(el),
        ratio: Math.round(r * 100) / 100,
        need,
        text: label(el),
      });
    }
  }

  return {
    findings,
    pageOverflow: Math.round(overflow),
    contrastUnmeasurable: unmeasurable,
    width: vw,
    height: window.innerHeight,
  };
})()`;
