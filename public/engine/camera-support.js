/**
 * Why the browser will not open a camera, in words a patient can act on.
 *
 * `navigator.mediaDevices` only exists in a secure context. A phone that opened
 * `http://<lan-ip>:3000` gets `undefined` there, so every call site must check
 * before it calls, and must never show the raw TypeError to a patient.
 *
 * This module is shared by the legacy engine, the Everyday companion, the React
 * app (loaded at runtime through `engineModule("camera-support")`) and the
 * standalone FingerSpeak studio. It touches no browser global at module scope,
 * so Node can import it in tests.
 */

/** @typedef {"no-navigator"|"no-media-devices"|"no-get-user-media"|"insecure-context"|"not-allowed"|"not-found"|"in-use"|"over-constrained"|"aborted"|"cancelled"|"unknown"} CameraCode */

/** @typedef {{ ok: boolean, code: CameraCode, secure: boolean | null, message: string }} CameraSupport */

/**
 * Every patient-facing camera sentence lives here, so the whole app explains a
 * camera failure the same way. A failure is never described in JavaScript terms.
 */
const MESSAGES = {
  "no-navigator":
    "This browser cannot open a camera. Try Chrome, Edge or Safari on this device.",
  "no-media-devices":
    "This browser does not support camera access. Try Chrome, Edge or Safari on this device.",
  "no-get-user-media":
    "This browser does not support camera access. Try Chrome, Edge or Safari on this device.",
  "insecure-context":
    "The camera needs a secure (https) address. Ask your caregiver for the https link to this app.",
  "not-allowed":
    "Camera permission was declined. Allow the camera in your browser settings, then try again.",
  "not-found": "No camera was found on this device.",
  "in-use":
    "The camera is already in use by another app. Close it, then try again.",
  "over-constrained":
    "This camera cannot use the picture settings ASHA asked for. Try the other camera.",
  aborted: "The camera stopped before it could start. Please try again.",
  cancelled: "The camera start was cancelled.",
  unknown: "The camera could not start. Please try again.",
};

/**
 * Whether this browser can open a camera at all, and why not when it cannot.
 *
 * @returns {CameraSupport}
 */
export function cameraSupport() {
  const secure =
    typeof globalThis.isSecureContext === "boolean"
      ? globalThis.isSecureContext
      : null;
  const nav = globalThis.navigator;
  if (typeof nav === "undefined" || nav === null) {
    return {
      ok: false,
      code: "no-navigator",
      secure,
      message: MESSAGES["no-navigator"],
    };
  }
  const devices = nav.mediaDevices;
  if (!devices) {
    // A secure context always exposes mediaDevices, so a missing one on an
    // insecure origin is the http-on-a-lan-ip case the operator can fix.
    const code = secure === false ? "insecure-context" : "no-media-devices";
    return { ok: false, code, secure, message: MESSAGES[code] };
  }
  if (typeof devices.getUserMedia !== "function") {
    return {
      ok: false,
      code: "no-get-user-media",
      secure,
      message: MESSAGES["no-get-user-media"],
    };
  }
  return { ok: true, code: "ok", secure, message: "" };
}

/**
 * The code for a camera failure, read from the error the browser raised.
 *
 * @param {unknown} err
 * @returns {CameraCode}
 */
export function cameraCode(err) {
  const name =
    err && typeof err === "object" ? String(/** @type {any} */ (err).name || "") : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "not-allowed";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "not-found";
    case "NotReadableError":
    case "TrackStartError":
      return "in-use";
    case "OverconstrainedError":
      return "over-constrained";
    case "AbortError":
      return "aborted";
    case "SecurityError":
      return "insecure-context";
    default:
      return "unknown";
  }
}

/**
 * A camera failure described in plain words.
 *
 * The only message this ever returns verbatim is one this module wrote itself
 * (a CameraError). Any other error is described by its name, so a raw
 * exception - "Cannot read properties of undefined (reading 'getUserMedia')" -
 * can never reach a patient.
 *
 * @param {unknown} err
 * @returns {string}
 */
export function cameraMessage(err) {
  if (err && typeof err === "object") {
    const any = /** @type {any} */ (err);
    if (any.name === "CameraError" && typeof any.message === "string" && any.message)
      return any.message;
  }
  return MESSAGES[cameraCode(err)] ?? MESSAGES.unknown;
}

/**
 * A camera failure that already carries its patient-facing sentence.
 *
 * The sentence always comes from this module's table, so a failure built here
 * can never contain a raw exception.
 *
 * @param {CameraCode} code
 * @param {string} [suffix] extra plain words, such as what still works
 * @returns {Error & { code: string }}
 */
export function cameraFailure(code, suffix) {
  const base = MESSAGES[code] ?? MESSAGES.unknown;
  const error = new Error(suffix ? `${base} ${suffix}` : base);
  error.name = "CameraError";
  /** @type {any} */ (error).code = code;
  return error;
}

/**
 * The camera failure to raise for this browser, or null when the camera can be
 * used. Callers that open the camera themselves use this to fail before they
 * pause anything else.
 *
 * @param {string} [suffix]
 * @returns {(Error & { code: string }) | null}
 */
export function cameraUnavailable(suffix) {
  const support = cameraSupport();
  return support.ok ? null : cameraFailure(support.code, suffix);
}

/**
 * A microphone failure described in plain words. The microphone needs the same
 * secure context as the camera, so it gets its own sentences.
 *
 * @param {unknown} err
 * @returns {string}
 */
export function microphoneMessage(err) {
  const code = cameraCode(err);
  switch (code) {
    case "not-allowed":
      return "Microphone permission was declined. Allow the microphone in your browser settings, then try again.";
    case "not-found":
      return "No microphone was found on this device.";
    case "insecure-context":
      return "The microphone needs a secure (https) address. Ask your caregiver for the https link to this app.";
    default:
      return "The microphone could not start. Please try again.";
  }
}
