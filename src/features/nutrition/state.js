// ASHA Nutrition V5 screen states (spec section 6). Every change of screen goes through `go`, so a
// double tap, a late worker message or a tab switch can't take the flow somewhere it shouldn't be:
// a second freeze while frozen is refused, and a meal can be logged only once.
export const STATES = Object.freeze([
  "IDLE",
  "MODE_SELECTED",
  "SCANNING",
  "QUALITY_WAIT",
  "CANDIDATE_STABLE",
  "SNAPSHOT_FROZEN",
  "IMAGE_SELECTED",
  "IMAGE_VALIDATED",
  "ANALYZING",
  "FOOD_REVIEW",
  "QUESTIONNAIRE",
  "INGREDIENT_REVIEW",
  "CALCULATING",
  "RESULT",
  "EDIT_ANSWERS",
  "LOGGED",
  "DISCARDED",
  "ERROR",
  "PERMISSION_DENIED",
  "RETRY",
  "MANUAL",
]);

const CAPTURE = ["SCANNING", "QUALITY_WAIT", "CANDIDATE_STABLE", "SNAPSHOT_FROZEN", "IMAGE_SELECTED", "IMAGE_VALIDATED", "ANALYZING"];
export const LIVE_INFERENCE = Object.freeze(["SCANNING", "QUALITY_WAIT"]);

/** Allowed next states. Leaving for IDLE (closing Nutrition, starting over) is always allowed. */
export const TRANSITIONS = Object.freeze({
  IDLE: ["MODE_SELECTED"],
  MODE_SELECTED: ["SCANNING", "IMAGE_SELECTED", "MANUAL", "PERMISSION_DENIED", "ERROR"],
  SCANNING: ["QUALITY_WAIT", "CANDIDATE_STABLE", "SNAPSHOT_FROZEN", "MANUAL", "ERROR", "PERMISSION_DENIED", "MODE_SELECTED"],
  QUALITY_WAIT: ["SCANNING", "CANDIDATE_STABLE", "SNAPSHOT_FROZEN", "MANUAL", "ERROR", "PERMISSION_DENIED", "MODE_SELECTED"],
  CANDIDATE_STABLE: ["SNAPSHOT_FROZEN", "SCANNING", "ERROR"],
  // Retake and Continue scanning go back to SCANNING; Confirm goes on to the food review.
  SNAPSHOT_FROZEN: ["FOOD_REVIEW", "SCANNING", "MANUAL", "ERROR"],
  IMAGE_SELECTED: ["IMAGE_VALIDATED", "ERROR", "MODE_SELECTED"],
  IMAGE_VALIDATED: ["ANALYZING", "IMAGE_SELECTED", "MODE_SELECTED"],
  ANALYZING: ["FOOD_REVIEW", "ERROR"],
  FOOD_REVIEW: ["QUESTIONNAIRE", "SCANNING", "IMAGE_SELECTED", "MODE_SELECTED", "DISCARDED"],
  QUESTIONNAIRE: ["INGREDIENT_REVIEW", "FOOD_REVIEW", "DISCARDED"],
  INGREDIENT_REVIEW: ["CALCULATING", "QUESTIONNAIRE", "FOOD_REVIEW", "DISCARDED"],
  CALCULATING: ["RESULT", "ERROR"],
  RESULT: ["EDIT_ANSWERS", "LOGGED", "DISCARDED"],
  EDIT_ANSWERS: ["CALCULATING", "QUESTIONNAIRE", "FOOD_REVIEW"],
  LOGGED: [],
  DISCARDED: [],
  ERROR: ["RETRY", "MANUAL"],
  PERMISSION_DENIED: ["RETRY", "MANUAL"],
  RETRY: ["MODE_SELECTED", "SCANNING", "IMAGE_SELECTED"],
  MANUAL: ["FOOD_REVIEW"],
});

export const canGo = (from, to) => to === "IDLE" || (TRANSITIONS[from] ?? []).includes(to);
export const isCapture = (s) => CAPTURE.includes(s);

export class NutritionFlow {
  /** @param {(to: string, detail?: unknown) => void} [onChange] */
  constructor(onChange = () => {}) {
    this.state = "IDLE";
    this.history = ["IDLE"];
    this.onChange = onChange;
    this.loggedId = null;
    this.captures = 0;
  }

  /**
   * Move to `to` if allowed. Returns false (and changes nothing) if not.
   * @param {string} to
   * @param {unknown} [detail]
   */
  go(to, detail) {
    if (!STATES.includes(to) || !canGo(this.state, to)) return false;
    if (to === "SNAPSHOT_FROZEN") this.captures += 1;
    if (to === "IDLE") this.loggedId = null;
    this.state = to;
    this.history.push(to);
    if (this.history.length > 200) this.history.splice(0, this.history.length - 200);
    this.onChange(to, detail);
    return true;
  }

  /** Should the live classifier run right now? Never after a freeze, until Retake. */
  get inferring() {
    return LIVE_INFERENCE.includes(this.state);
  }

  /**
   * Write the log once. A second call (double tap, retry) returns the first id and writes nothing.
   * @param {() => string} write
   */
  logOnce(write) {
    if (this.loggedId) return { id: this.loggedId, duplicate: true };
    if (this.state !== "RESULT") return { id: null, refused: true };
    const id = write();
    this.loggedId = id;
    this.go("LOGGED");
    return { id, duplicate: false };
  }
}
