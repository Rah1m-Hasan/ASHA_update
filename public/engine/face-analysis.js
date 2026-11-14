// Detailed observation pipeline restored from NeuroFace Sense. This does not
// replace the calibrated Engine's blink/smile/head command state machines.
import { BlinkCounter } from "./blink-counter.js";
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const clamp = (n) => Math.max(0, Math.min(1, n));
// How far the resting face may drift before the neutral reference no longer
// describes it, and how far the head may be from the reference orientation
// for the facial comparison to be meaningful at all.
const NEUTRAL_FACE_TOLERANCE = 0.006;
const NEUTRAL_MOUTH_TOLERANCE = 0.02;
const NEUTRAL_POSE_TOLERANCE = 6;
export class FaceAnalysis {
  constructor() {
    this.reset();
  }
  reset() {
    this.activity = new globalThis.NF_activity.Tracker(45);
    this.lipWatch = new globalThis.NF_lipWatch.Watch(60);
    this.neutralFrames = [];
    this.neutral = null;
    this.previous = null;
    this.blinkCounter = new BlinkCounter();
    this.lastNod = null;
    this.motionFrames = [];
    this.log = [];
    this.lastT = null;
  }
  addLog(t, label, kind = "movement") {
    this.log.unshift({ t, label, kind });
    this.log = this.log.slice(0, 100);
  }
  /**
   * Has the neutral reference stopped describing the person's resting face?
   *
   * The facial geometry is compared with the reference, but only while the
   * head is in the same place: the corner positions move with the head, so a
   * turned head would otherwise look like a changed face. The head pose
   * itself is never a reason to refresh, for the reason given at the call
   * site.
   */
  neutralIsStale(candidate) {
    const n = this.neutral;
    if (!n) return false;
    if (
      Math.abs(candidate.yaw - n.yaw) > NEUTRAL_POSE_TOLERANCE ||
      Math.abs(candidate.pitch - n.pitch) > NEUTRAL_POSE_TOLERANCE ||
      Math.abs(candidate.roll - n.roll) > NEUTRAL_POSE_TOLERANCE
    )
      return false;
    if (Math.abs(candidate.dev0 - n.dev0) > NEUTRAL_FACE_TOLERANCE) return true;
    if (Math.abs(candidate.mouthW - n.mouthW) > NEUTRAL_MOUTH_TOLERANCE) return true;
    for (const key of ["cornerLX", "cornerLY", "cornerRX", "cornerRY"])
      if (Math.abs(candidate[key] - n[key]) > NEUTRAL_FACE_TOLERANCE) return true;
    return false;
  }
  update(lm, f, r, baseline, t) {
    const M = globalThis.NF_metrics;
    const valid = !!(
      lm?.length >= 468 &&
      f.facePresent &&
      f.faceQuality >= 0.65
    );
    const previousBlinkTotal = this.blinkCounter.total;
    const eye = this.blinkCounter.update({ ...f, facePresent: valid }, t);
    if (eye.total > previousBlinkTotal)
      this.addLog(t, "blink observed · bilateral EAR drop and reopening");
    if (this.lastT !== null && t - this.lastT > 500) {
      this.lipWatch.reset();
      this.previous = null;
      this.motionFrames = [];
    }
    this.lastT = t;
    if (!valid) {
      this.lipWatch.reset();
      this.previous = null;
      if (!this.neutral) {
        this.neutralFrames = [];
        this.activity.reset();
      }
      return {
        valid: false,
        ready: !!this.neutral,
        reason: r.reason || "Face not reliably visible",
        log: this.log,
        lip: { duration: 0, latched: false },
        au: { ready: !!this.activity.baseline, invalid: true, values: {} },
        eye,
      };
    }
    const geomHead = M.headPose(lm);
    const still =
      !this.previous ||
      Math.hypot(f.yaw - this.previous.yaw, f.pitch - this.previous.pitch) <
        1.5;
    const relaxed =
      Math.max(f.mouthSmileLeft, f.mouthSmileRight) < 0.25 &&
      Math.max(f.eyeBlinkLeft, f.eyeBlinkRight) < 0.25 &&
      f.jawOpen < 0.25 &&
      // Do not learn a held one-sided lip shift as the resting reference.
      // Until a centered reference is available, the same original absolute
      // displacement thresholds remain observable by the sustained-hold watch.
      Math.abs(M.lipDeviation(lm, 0)) < 0.035 &&
      Math.abs(M.lipAsymmetry(lm, null)) < 0.04;
    let au;
    const browReliable = eye.state === "OPEN" && Math.max(f.eyeBlinkLeft, f.eyeBlinkRight) < 0.25;
    // "At rest by the caller's own test" is what lets the tracker re-anchor a
    // reference that no longer describes the person's resting face.
    const atRest = still && relaxed && browReliable;
    if (this.activity.baseline || atRest)
      au = this.activity.update(lm, { aspect: f.imageAspect || 1, browReliable, neutral: atRest });
    else
      au = {
        ready: false,
        progress: this.activity.samples.length,
        values: {},
        paused: true,
      };
    if (still && relaxed) {
      this.neutralFrames.push({
        mouthW: M.mouthWidth(lm),
        dev0: M.lipDeviation(lm, 0),
        cornerLX: lm[61].x,
        cornerLY: lm[61].y,
        cornerRX: lm[291].x,
        cornerRY: lm[291].y,
        yaw: f.yaw,
        pitch: f.pitch,
        roll: f.roll,
        geomYaw: geomHead.yaw,
        geomPitch: geomHead.pitch,
        geomRoll: geomHead.roll,
      });
      if (this.neutralFrames.length >= 45) {
        const b = Object.fromEntries(
          Object.keys(this.neutralFrames[0]).map((k) => [
            k,
            median(this.neutralFrames.map((x) => x[k])),
          ]),
        );
        if (!this.neutral) {
          this.neutral = {
            ...b,
            head: { yaw: b.geomYaw, pitch: b.geomPitch, roll: b.geomRoll },
          };
          this.addLog(
            t,
            "Neutral facial reference captured from 45 live frames",
            "calibration",
          );
        } else if (this.neutralIsStale(b)) {
          // The captured reference no longer describes the person's resting
          // face: the geometry has moved. The facial part of the reference is
          // refreshed, so the sustained-lip-shift watch is measured against
          // the face the person actually has now.
          //
          // The head orientation is deliberately NOT refreshed. Turning the
          // head is exactly what the head labels exist to show, so a
          // reference that followed the head would report "Centered" for a
          // head that is turned 30 degrees.
          this.neutral = {
            ...this.neutral,
            mouthW: b.mouthW,
            dev0: b.dev0,
            cornerLX: b.cornerLX,
            cornerLY: b.cornerLY,
            cornerRX: b.cornerRX,
            cornerRY: b.cornerRY,
          };
          this.addLog(
            t,
            "Neutral facial reference refreshed: the resting face geometry changed",
            "calibration",
          );
        }
        this.neutralFrames = [];
      }
    }
    const n = this.neutral;
    const head = {
      yaw: f.yaw - (baseline.calibrated ? baseline.neutralYaw : (n?.yaw ?? 0)),
      pitch:
        f.pitch -
        (baseline.calibrated ? baseline.neutralPitch : (n?.pitch ?? 0)),
      roll:
        f.roll - (baseline.calibrated ? baseline.neutralRoll : (n?.roll ?? 0)),
      state: r.states?.head || "Unavailable",
      nodState: r.states?.nod || "Unavailable",
    };
    head.label =
      !n && !baseline.calibrated
        ? "Learning neutral"
        : head.yaw < -12
          ? "Head left"
          : head.yaw > 12
            ? "Head right"
            : head.pitch > 10
              ? "Head down"
              : head.pitch < -10
                ? "Head up"
                : Math.abs(head.roll) > 10
                  ? "Head tilt"
                  : "Centered";
    for (const e of r.events || []) {
      if (e.type === "NOD_COMPLETED") this.lastNod = t;
      if (
        [
          "NOD_COMPLETED",
          "LEFT_TURN_COMPLETED",
          "RIGHT_TURN_COMPLETED",
          "SMILE_COMPLETED",
          "PUCKER_COMPLETED",
        ].includes(e.type)
      )
        this.addLog(
          t,
          e.type.replaceAll("_", " ").toLowerCase() +
            (e.deliberate ? " · deliberate" : ""),
        );
    }
    const gaze = f.gaze?.available
      ? { ...f.gaze, label: M.gazeLabel(f.gaze) }
      : { available: false, label: "Unavailable (no iris)" };
    const smile = {
      intensity: r.smile?.smileIntensity ?? M.smileIntensity(lm, n),
      symmetry: r.smile?.symmetryScore ?? M.symmetryScore(lm, n),
      left: r.smile?.leftIntensity,
      right: r.smile?.rightIntensity,
      state: r.states?.smile || "Observing",
    };
    const lateral = M.lipDeviation(lm, n?.dev0 || 0),
      corner = M.lipAsymmetry(lm, n);
    // Original rule: strongest normalized lateral/corner displacement,
    // 60 seconds on the same side, modest head-pose gate, symmetric smiles excluded.
    const lateralThreshold = 0.035,
      cornerThreshold = 0.04;
    const useCorner =
      Math.abs(corner) / cornerThreshold > Math.abs(lateral) / lateralThreshold;
    const deviation = useCorner ? corner : lateral,
      threshold = useCorner ? cornerThreshold : lateralThreshold;
    const active =
      Math.abs(head.yaw) < 20 &&
      Math.abs(head.roll) < 12 &&
      (smile.intensity < 0.4 || smile.symmetry < 75) &&
      Math.abs(deviation) >= threshold;
    const side = deviation > 0 ? "right" : "left";
    const fired = this.lipWatch.update(t / 1000, active, side);
    if (fired)
      this.addLog(
        t,
        `Sustained ${side} ${useCorner ? "mouth-corner asymmetry" : "lateral lip shift"} for 60 seconds · possible movement abnormality; review needed`,
        "observation",
      );
    const gesture =
      smile.intensity > 0.45
        ? "Smile"
        : f.mar < 0.07
          ? "Lip closure"
          : f.mar > 0.38
            ? "Lip open"
            : r.pucker > 0.45
              ? "Lip pucker"
              : "Neutral";
    let motion = {
      displacement: 0,
      acceleration: 0,
      frequency: null,
      label: "Stable / resting",
    };
    if (this.previous?.lm) {
      const ids = [1, 33, 263, 61, 291, 13, 14, 105, 334, 152];
      const displacement =
        ids.reduce(
          (s, id) =>
            s +
            Math.hypot(
              lm[id].x - this.previous.lm[id].x,
              lm[id].y - this.previous.lm[id].y,
            ),
          0,
        ) / ids.length;
      const dt = Math.max(0.001, (t - this.previous.t) / 1000);
      motion.displacement = displacement;
      motion.acceleration =
        Math.abs(displacement - (this.previous.displacement || 0)) / dt;
      this.motionFrames.push({ t, d: displacement });
      this.motionFrames = this.motionFrames.filter((x) => t - x.t < 2000);
      const mean =
        this.motionFrames.reduce((s, x) => s + x.d, 0) /
        this.motionFrames.length;
      const duration = (t - this.motionFrames[0].t) / 1000;
      let crossings = 0;
      for (let i = 1; i < this.motionFrames.length; i++)
        if (
          (this.motionFrames[i - 1].d - mean) *
            (this.motionFrames[i].d - mean) <
          0
        )
          crossings++;
      const hz = duration > 1.5 ? crossings / 2 / duration : null;
      motion = {
        ...motion,
        frequency: hz,
        label:
          mean > 0.012 && hz >= 3 && hz <= 12
            ? "Rapid repeated movement"
            : mean > 0.016
              ? "Large / abrupt movement"
              : mean < 0.0012
                ? "Stable / resting"
                : "Movement detected",
      };
    }
    this.previous = {
      lm,
      t,
      yaw: f.yaw,
      pitch: f.pitch,
      displacement: motion.displacement,
    };
    const auv = au.values || {};
    const tension = Math.max((auv.AU20 || 0) / 100, clamp((0.09 - f.mar) * 6));
    const affect = {
      browCornerPattern:
        (0.35 * (auv.AU1 || 0)) / 100 +
        0.3 * clamp(M.cornerDepression(lm) / 0.03) +
        (0.2 * (auv.AU4 || 0)) / 100 +
        0.15 * (1 - smile.intensity),
      squeezeTensionPattern:
        (0.3 * (auv.AU4 || 0)) / 100 +
        (0.25 * (auv.AU6 || 0)) / 100 +
        0.2 * clamp((0.28 - f.earMean) * 4) +
        0.25 * tension,
    };
    return {
      valid,
      ready: !!n,
      neutralProgress: this.neutralFrames.length,
      au,
      gaze,
      head: {
        ...head,
        nodRecent: this.lastNod !== null && t - this.lastNod < 1800,
      },
      smile,
      motion,
      affect,
      eye,
      lip: {
        gesture,
        pucker: r.pucker || 0,
        lateral,
        corner,
        deviation,
        threshold,
        active,
        side,
        kind: useCorner ? "Corner asymmetry" : "Lateral shift",
        duration: this.lipWatch.duration,
        latched: this.lipWatch.latched,
        fired,
      },
      log: this.log,
      scores: r.accepted ? r.scores : null,
      reason: r.accepted ? "Temporal recognition active" : r.reason,
    };
  }
}
