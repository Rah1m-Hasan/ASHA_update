// Loads the browser engine (MediaPipe globals + ES modules served from /public).
const CLASSIC = [
  "/neuroface/utils/landmarks.js",
  "/neuroface/utils/metrics.js",
  "/neuroface/src/vision.js",
  "/neuroface/src/engine.js",
  "/neuroface/src/calibration.js",
  "/neuroface/src/activity.js",
  "/neuroface/src/lip-watch.js",
  "/neuroface/src/fingerspeak-signal.js",
];

let classic: Promise<void> | null = null;

function script(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[data-engine="${src}"]`)) return resolve();
    const el = document.createElement("script");
    el.src = src;
    el.async = false;
    el.dataset.engine = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.append(el);
  });
}

export function loadClassicScripts() {
  classic ??= (async () => {
    for (const src of CLASSIC) await script(src);
  })().catch((error) => {
    // A failed load is not kept. One dropped connection used to leave the
    // rejected promise cached for the whole session, so the engine could not
    // be loaded again even after the network came back.
    classic = null;
    throw error;
  });
  return classic;
}

/** Dynamic import of an engine module from /engine, bypassing the bundler. */
export function engineModule<T>(name: string): Promise<T> {
  const url = `/engine/${name}.js`;
  return import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url) as Promise<T>;
}
