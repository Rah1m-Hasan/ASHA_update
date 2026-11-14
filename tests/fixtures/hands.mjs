// Synthetic hand traces for FingerSpeak: 21-point hand landmarks that classify
// as a known pose, with detection dropouts the way a real detector flickers.

import { rng, noisy } from "./random.mjs";

/**
 * A 21-point hand whose fingers are either straight (extended) or folded
 * (closed). `openness` 1 means straight, 0 means folded.
 */
export function handLandmarks({ open = true, x = 0.5, y = 0.5, scale = 0.1, noise = 0, seed = 6 } = {}) {
  const next = rng(seed);
  const landmarks = Array.from({ length: 21 }, () => ({ x, y, z: 0 }));
  const chains = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
  ];
  const put = (index, px, py) => {
    landmarks[index] = {
      x: noisy(next, px, noise),
      y: noisy(next, py, noise),
      z: 0,
    };
  };
  put(0, x, y);
  chains.forEach((chain, finger) => {
    const baseX = x - scale * 0.3 + finger * scale * 0.15;
    const baseY = y - scale * 0.2;
    const length = scale * (1 - finger * 0.12);
    // Straight: the chain marches away from the wrist in a line.
    // Folded: the chain doubles back on itself.
    if (open) {
      put(chain[0], baseX, baseY);
      put(chain[1], baseX, baseY - length * 0.4);
      put(chain[2], baseX, baseY - length * 0.7);
      put(chain[3], baseX, baseY - length);
    } else {
      put(chain[0], baseX, baseY);
      put(chain[1], baseX, baseY - length * 0.35);
      put(chain[2], baseX + length * 0.25, baseY - length * 0.2);
      put(chain[3], baseX + length * 0.4, baseY + length * 0.1);
    }
  });
  return landmarks;
}

/**
 * A hand part-way between folded and straight. `amount` 1 is a straight
 * hand, 0 a folded one. Used for a person whose fingers do not straighten
 * fully: their open hand never reaches the fixed open level.
 */
export function partialHandLandmarks({ amount = 0.6, x = 0.5, y = 0.5, scale = 0.1, noise = 0, seed = 6 } = {}) {
  const straight = handLandmarks({ open: true, x, y, scale, noise: 0, seed });
  const folded = handLandmarks({ open: false, x, y, scale, noise: 0, seed });
  return straight.map((point, index) => ({
    x: folded[index].x + (point.x - folded[index].x) * amount,
    y: folded[index].y + (point.y - folded[index].y) * amount,
    z: 0,
  }));
}

/**
 * A sequence of hand detections with dropouts.
 *
 * `dropouts` lists frame indices where the detector returned nothing — the
 * flicker that resets `PoseTracker`'s per-hand state.
 */
export function handSequence({
  fps = 20,
  durationMs = 5000,
  open = true,
  x = 0.5,
  y = 0.5,
  seed = 7,
  noise = 0.001,
  dropouts = [],
} = {}) {
  const next = rng(seed);
  const step = 1000 / fps;
  const dropped = new Set(dropouts);
  const frames = [];
  let index = 0;
  for (let t = 0; t <= durationMs; t += step) {
    const i = index++;
    if (dropped.has(i)) {
      frames.push({ t, hands: [] });
      continue;
    }
    frames.push({
      t,
      hands: [
        {
          id: "hand-1",
          label: "right",
          lm: handLandmarks({ open, x, y, noise, seed: seed + i }),
        },
      ],
    });
  }
  return frames;
}
