// Deterministic pseudo-randomness for accuracy fixtures.
// Every fixture is reproducible from its seed so a baseline run and a later
// "after" run measure exactly the same inputs.

/** Mulberry32: small, fast, and identical on every machine. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller normal deviate from a uniform generator. */
export function gaussian(next) {
  let u = 0;
  let v = 0;
  while (u === 0) u = next();
  while (v === 0) v = next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** A normal deviate with the given mean and standard deviation. */
export function noisy(next, mean = 0, sd = 0) {
  return mean + (sd ? gaussian(next) * sd : 0);
}

/** Clamp to a range, the way the engine's own helpers do. */
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
