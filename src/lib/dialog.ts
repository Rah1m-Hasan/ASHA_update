// Which dialog, if any, is on top. The gaze board pauses while one is open, the eye cursor moves
// its pointer into it, and the eye cursor only offers what is inside it. All three ask several
// times a second, so the answer is cached for a moment instead of looked up for every frame.

let cached: HTMLDialogElement | null = null;
let at = -Infinity;

/** The open dialog, or null. Cached for a quarter of a second. */
export function activeDialog(now = performance.now()): HTMLDialogElement | null {
  if (now - at > 250) {
    cached = openDialog();
    at = now;
  }
  return cached;
}

/** The open dialog, or null, looked up now: for when the answer must be exact this moment. */
export function openDialog(): HTMLDialogElement | null {
  return document.querySelector<HTMLDialogElement>("dialog[open]");
}
