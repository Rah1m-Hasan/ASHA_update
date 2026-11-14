import {
  poseFeatures,
  RestTracker,
  SustainedCue,
} from "./signals.js";
import { HandTracks } from "./hand-tracks.js";
import { FaceAnalysis } from "./face-analysis.js";
import { VitalSense, vitalROIs } from "./vitalsense.js";
import { MODEL_THRESHOLDS } from "./model-thresholds.js";
import { MotionMeter } from "./motion-meter.js";

/** A worker frame that takes longer than this is a stall, not a slow device. */
const WORKER_STALL_MS = 2000;
export class Perception extends EventTarget {
  constructor(video, canvas) {
    super();
    this.video = video;
    this.canvas = canvas;
    this.running = false;
    this.extractor = new NF_vision.Extractor();
    this.engine = new NF_engine.Engine();
    this.handTracker = new NF_fingerspeakSignal.PoseTracker(800);
    this.rest = new RestTracker();
    this.postureCue = new SustainedCue();
    this.analysis = new FaceAnalysis();
    this.vitals = new VitalSense();
    this.pulse = this.vitals.value;
    this.motionMeter = new MotionMeter();
    // The pose motion sample waiting to be consumed by the rest tracker. It
    // is consumed once, when it arrives.
    this.pendingMotion = null;
    // Observed interval between face results, used to bound how old a face
    // landmark ROI may be before its colour sample is rejected.
    this.faceResultIntervalMs = 0;
    this.snapshot = {};
    this.enabled = [];
    this.handStates = {};
    this.yoloEnabled = false;
    this.onVisibilityChange = () => {
      if (document.hidden) {
        this.invalidateVitals("Monitoring paused while this page is hidden");
      }
    };
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }
  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
  setCalibration(b, enabled = []) {
    this.engine = new NF_engine.Engine({ baseline: b });
    this.enabled = enabled;
  }
  resetFaceReference() {
    this.analysis.reset();
  }
  resetVitalsBaseline() {
    this.pulse = this.vitals.resetBaseline();
    this.snapshot.pulse = this.pulse;
    this.emit("vitals", this.pulse);
  }
  resetVitalsSession() {
    this.vitals.reset();
    this.pulse = this.vitals.value;
    this.snapshot.pulse = this.pulse;
    this.emit("vitals", this.pulse);
  }
  invalidateVitals(reason = "Monitoring paused") {
    this.pulse = this.vitals.invalidate(reason);
    this.snapshot.pulse = this.pulse;
    this.emit("vitals", this.pulse);
  }
  setActiveModule(name) {
    this.activeModule = name;
    const move = name === "move" ? this.moveTracking || { pose: true, hands: false } : null;
    this.handsPriority = name === "fingerspeak" || !!this.neuralHandActive || !!move?.hands;
    // Move counts repetitions from consecutive frames, so the model an exercise needs runs near
    // camera rate there; the others keep their slow default cadence (model router).
    this.posePeriod = move?.pose ? 50 : 500;
    // EyeSpeak needs only the face model, as often as the device allows: a pose or hand pass on the
    // same frame delays the next face result, and gaze dwell needs steady results. The eye cursor
    // needs the same on every page, except pages that are about hands or the body.
    const needsBody = name === "move" || name === "posture" || name === "fingerspeak" || name === "senseassist" || !!this.neuralHandActive;
    this.faceOnly = name === "eyespeak" || (!!this.gazeCursor && !needsBody);
    this.worker?.postMessage({
      type: "schedule",
      handsPriority: this.handsPriority,
      posePeriod: this.posePeriod,
      faceOnly: this.faceOnly,
    });
  }
  /** The eye cursor reads the face points on every page while it is on. */
  setGazeCursor(on) {
    this.gazeCursor = !!on;
    this.setActiveModule(this.activeModule);
  }
  /** Move's model router: which landmark models the current exercise needs at full rate. */
  setMoveTracking(modules = {}) {
    this.moveTracking = { pose: !!modules.pose, hands: !!modules.hands };
    this.setActiveModule(this.activeModule);
  }
  /** Front ("user") or back ("environment") camera. Swaps the stream; the models keep running. */
  async setFacingMode(facing) {
    this.facingMode = facing === "environment" ? "environment" : "user";
    if (!this.running) return this.facingMode;
    const next = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: this.facingMode }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } },
      audio: false,
    });
    const old = this.stream;
    this.stream = next;
    this.video.srcObject = next;
    await this.video.play().catch(() => {});
    old?.getTracks().forEach((t) => t.stop());
    this.lastTime = this.lastHandTime = null;
    // The new camera's colours must not be sampled through the old camera's
    // landmarks: those ROIs sit somewhere else on the new image, so the vital
    // signal would read skin from the wrong place.
    this.faceResult = null;
    this.faceResultAt = 0;
    this.vitalsFaceFeatures = null;
    this.pulseGeometry = null;
    this.poseResult = null;
    this.poseResultAt = 0;
    this.posture = null;
    this.poseAt = 0;
    this.pendingMotion = null;
    this.vitalsMotion = 0;
    this.motionMeter?.reset();
    this.faceResultIntervalMs = 0;
    this.invalidateVitals("Camera changed; waiting for a fresh signal");
    return next.getVideoTracks()[0]?.getSettings?.().facingMode || this.facingMode;
  }
  async start() {
    if (this.running) return;
    this.cycles = { face: 0, hand: 0, pose: 0, pulse: 0 };
    this.emit("status", "Loading face, two-hand and pose models…");
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: this.facingMode === "environment" ? { ideal: "environment" } : "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30, max: 30 },
      },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();
    this.running = true;
    this.setActiveModule(this.activeModule);
    try {
      await this.initWorker();
    } catch (e) {
      this.worker?.terminate();
      this.worker = null;
      this.handWorker?.terminate();
      this.handWorker = null;
      this.emit("status", "Using compatible camera mode…");
      await this.initMain();
    }
    this.running = true;
    this.emit("status", "Camera active · all sensing shares one stream");
    this.setActiveModule(this.activeModule);
    this.loop();
  }
  async initWorker() {
    // Separate one-frame queues keep real hand samples flowing during pose work.
    // Both workers consume this same MediaStream; neither opens another camera.
    try {
      await Promise.all([
        this.createWorker("face", "worker"),
        this.createWorker("hand", "handWorker"),
      ]);
    } catch {
      this.worker?.terminate();
      this.handWorker?.terminate();
      this.worker = this.handWorker = null;
      await this.createWorker("all", "worker");
    }
  }
  async createWorker(role, property) {
    await new Promise((resolve, reject) => {
      const worker = new Worker(new URL("./vision-worker.js", import.meta.url));
      this[property] = worker;
      const timeout = setTimeout(
        () => reject(Error("Worker startup timeout")),
        25000,
      );
      worker.onerror = () => {
        clearTimeout(timeout);
        reject(Error("Worker unavailable"));
      };
      worker.onmessage = ({ data: d }) => {
        if (d.type === "ready") {
          clearTimeout(timeout);
          resolve();
        } else if (d.type === "error") {
          clearTimeout(timeout);
          reject(Error(d.message));
        } else if (d.type === "result") {
          if (role === "hand") {
            this.handBusy = false;
            if (this.running) this.consumeHands(d.hand, d.t);
          } else {
            this.busy = false;
            this.result(d);
          }
        } else if (d.type === "frameError") {
          if (role === "hand") this.handBusy = false;
          else this.busy = false;
          this.emit("status", "Tracking interrupted. Reposition the camera.");
        }
      };
      worker.postMessage({ type: "init", role });
    });
  }
  /**
   * A worker that stops answering leaves its busy flag set forever, and the
   * camera then silently produces no frames at all. A frame normally takes
   * well under a second, so anything older than this is a stall, not a slow
   * device: clear the flag, let the next frame through, and tell the patient.
   */
  checkWorkerStall(t) {
    const stale = t - (this.workerFrameAt || 0);
    if (this.busy && stale > WORKER_STALL_MS) {
      this.busy = false;
      this.emit("status", "Tracking interrupted. Reposition the camera.");
    }
    if (this.handBusy && t - (this.handWorkerFrameAt || 0) > WORKER_STALL_MS) {
      this.handBusy = false;
      this.emit("status", "Tracking interrupted. Reposition the camera.");
    }
  }
  async initMain() {
    const V = await import("../neuroface/vendor/vision_bundle.mjs");
    const files = await V.FilesetResolver.forVisionTasks(
      new URL("../neuroface/vendor/wasm/", import.meta.url).href,
    );
    const opts = (model) => ({
      baseOptions: {
        modelAssetPath: new URL(model, import.meta.url).href,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
    });
    try {
      this.face = await V.FaceLandmarker.createFromOptions(files, {
        ...opts("../neuroface/models/face_landmarker.task"),
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        ...MODEL_THRESHOLDS.face,
      });
    } catch {
      const o = opts("../neuroface/models/face_landmarker.task");
      o.baseOptions.delegate = "CPU";
      this.face = await V.FaceLandmarker.createFromOptions(files, {
        ...o,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        ...MODEL_THRESHOLDS.face,
      });
    }
    const create = async (Type, model, extra) => {
      const o = { ...opts(model), ...extra };
      try {
        return await Type.createFromOptions(files, o);
      } catch {
        o.baseOptions.delegate = "CPU";
        return Type.createFromOptions(files, o);
      }
    };
    this.hand = await create(
      V.HandLandmarker,
      "../neuroface/models/hand_landmarker.task",
      { numHands: 2, ...MODEL_THRESHOLDS.hand },
    );
    this.pose = await create(
      V.PoseLandmarker,
      "../models/pose_landmarker_lite.task",
      { numPoses: 1, ...MODEL_THRESHOLDS.pose },
    );
    this.lastHand = 0;
    this.lastPose = 0;
  }
  async loop() {
    if (!this.running) return;
    const t = performance.now();
    // A worker that stopped answering must not freeze the camera silently.
    this.checkWorkerStall(t);
    // Color sampling follows actual video frames, independent of slower face/hand
    // inference. Reuse the latest fresh landmarks and the existing camera only.
    if (!document.hidden && this.video.readyState >= 2 &&
        this.video.currentTime !== this.lastPulseVideoTime && t - (this.lastPulseFrame || 0) >= 25) {
      this.lastPulseVideoTime = this.video.currentTime;
      this.lastPulseFrame = t;
      this.samplePulse(this.faceResult, this.vitalsFaceFeatures, t);
      this.cycles.pulse++;
      if (t - (this.lastVitalsEmit || 0) >= 200) {
        this.lastVitalsEmit = t;
        this.emit("vitals", this.pulse);
      }
    }
    // Move's lighting check: mean brightness of a tiny downscaled frame, twice a second.
    if (this.activeModule === "move" && !document.hidden && this.video.readyState >= 2 && t - (this.lastLuma || 0) >= 500) {
      this.lastLuma = t;
      try {
        this.lumaCanvas ??= Object.assign(document.createElement("canvas"), { width: 16, height: 12 });
        const lc = this.lumaContext ??= this.lumaCanvas.getContext("2d", { willReadFrequently: true });
        lc.drawImage(this.video, 0, 0, 16, 12);
        const px = lc.getImageData(0, 0, 16, 12).data;
        let sum = 0;
        for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        this.luma = sum / (px.length / 4) / 255;
      } catch {
        this.luma = null;
      }
    }
    if (this.lastPulseFrame && t - this.lastPulseFrame > 600 && (this.pulse.bpm != null || this.vitals.rows.length)) {
      this.invalidateVitals("Camera frames stopped; waiting for a fresh signal");
    }
    if (
      this.handWorker &&
      !this.faceOnly &&
      !document.hidden &&
      !this.handBusy &&
      this.video.readyState >= 2 &&
      this.video.currentTime !== this.lastHandTime &&
      t - (this.lastHandFrame || 0) >= (this.handsPriority ? 16 : 250)
    ) {
      this.handBusy = true;
      this.lastHandTime = this.video.currentTime;
      this.lastHandFrame = t;
      this.handWorkerFrameAt = t;
      const worker = this.handWorker;
      createImageBitmap(this.video)
        .then((bitmap) => {
          if (!this.running || this.handWorker !== worker)
            return bitmap.close();
          worker.postMessage({ type: "frame", bitmap, t }, [bitmap]);
        })
        .catch(() => {
          this.handBusy = false;
        });
    }
    if (
      !document.hidden &&
      !this.busy &&
      this.video.readyState >= 2 &&
      this.video.currentTime !== this.lastTime &&
      t - (this.lastFrame || 0) >= 25
    ) {
      this.busy = true;
      this.lastTime = this.video.currentTime;
      this.lastFrame = t;
      this.workerFrameAt = t;
      try {
        if (this.worker) {
          const bitmap = await createImageBitmap(this.video);
          this.worker.postMessage({ type: "frame", bitmap, t }, [bitmap]);
        } else {
          const start = performance.now(),
            face = this.face.detectForVideo(this.video, t);
          let hand = null,
            pose = null;
          const handDue = (t - this.lastHand) / (this.handsPriority ? 1 : 250),
            poseDue = (t - this.lastPose) / (this.posePeriod || 500);
          if (this.faceOnly) {
            // Face only (EyeSpeak).
          } else if (
            handDue >= 1 &&
            (this.handsPriority ? poseDue < 1 : handDue >= poseDue)
          ) {
            hand = this.hand.detectForVideo(this.video, t);
            this.lastHand = t;
          } else if (poseDue >= 1) {
            pose = this.pose.detectForVideo(this.video, t);
            this.lastPose = t;
          }
          this.busy = false;
          this.result({ face, hand, pose, t, ms: performance.now() - start });
        }
      } catch (e) {
        this.busy = false;
        this.emit(
          "status",
          "Camera frame unavailable. Try restarting monitoring.",
        );
      }
      if (
        this.yoloEnabled &&
        this.yoloWorker &&
        !this.yoloBusy &&
        t - (this.lastYolo || 0) > 1800
      ) {
        this.lastYolo = t;
        this.yoloBusy = true;
        createImageBitmap(this.video)
          .then((bitmap) =>
            this.yoloWorker.postMessage({ type: "frame", bitmap }, [bitmap]),
          )
          .catch(() => (this.yoloBusy = false));
      }
    }
    this.raf = requestAnimationFrame(() => this.loop());
  }
  result(d) {
    if (!this.running) return;
    this.cycles.face++;
    const f = this.extractor.extract(d.face, this.video, d.t),
      // The engine classifies intent; only the parent confirmation gate may act.
      r = this.engine.process({ ...f, commandsEnabled: true });
    const currentLandmarks = d.face.faceLandmarks?.[0];
    // The face-motion estimate is measured over fixed time baselines rather
    // than between consecutive frames, so it means the same thing at 10 fps
    // and at 40 fps. A gap holds the last value: motion is unknown, not zero.
    this.vitalsMotion = this.motionMeter
      ? this.motionMeter.update(d.t, currentLandmarks)
      : this.vitalsMotion || 0;
    this.faceResult = d.face;
    this.faceResultAt = d.t;
    this.vitalsFaceFeatures = f;
    const analysis = this.analysis.update(
      d.face.faceLandmarks?.[0],
      f,
      r,
      this.engine.baseline,
      d.t,
    );
    if (d.pose) {
      this.cycles.pose++;
      this.poseResult = d.pose;
      this.poseResultAt = d.t;
      this.posture = poseFeatures(d.pose.landmarks?.[0], this.posture, d.t);
      // The motion sample belongs to this pose result. It is consumed once,
      // when it arrives, instead of being replayed on every face frame.
      this.pendingMotion = {
        motion: this.posture.motion,
        motionRate: this.posture.motionRate,
      };
      this.poseAt = d.t;
      this.emit("pose", {
        landmarks: d.pose.landmarks?.[0] ?? null,
        personCount: d.pose.landmarks?.length ?? 0,
        timestamp: d.t,
        width: this.video.videoWidth || 1,
        height: this.video.videoHeight || 1,
      });
    }
    if (d.hand) this.consumeHands(d.hand, d.t);
    for (const e of r.events) {
      this.emit("gesture", {
        ...e,
        smiling: !!r.smile?.smileDetected,
        smileIntensity: r.smile?.smileIntensity || 0,
      });
    }
    for (const command of r.commands || []) this.emit("facecommand", command);
    const poseValid = this.posture?.valid && d.t - this.poseAt < 1200;
    const rest = this.rest.update({
      t: d.t,
      valid: r.accepted && !!poseValid,
      closed: f.eyeBlinkLeft > 0.65 && f.eyeBlinkRight > 0.65,
      // null means "no new motion sample", which is unknown rather than
      // still: a stale value must not be read as a fresh observation.
      motion: this.pendingMotion?.motion ?? null,
      motionRate: this.pendingMotion?.motionRate ?? null,
    });
    this.pendingMotion = null;
    if (rest) this.emit("cue", rest);
    if (this.postureCue.update(this.posture?.sideways, !!poseValid, d.t))
      this.emit("cue", "posture");
    if (analysis.lip?.fired) this.emit("cue", "face_change");
    this.snapshot = {
      cycles: { ...this.cycles },
      analysis,
      blendshapes: Object.fromEntries(
        (d.face.faceBlendshapes?.[0]?.categories || []).map((c) => [
          c.categoryName,
          c.score,
        ]),
      ),
      raw: f,
      face: r,
      posture: this.posture,
      hands: this.hands || [],
      pulse: this.pulse,
      latency: Math.round(d.ms),
      blinks: analysis.eye.total,
      activity: this.rest.resting ? "Rest-like pattern" : "Observing",
      t: d.t,
      yolo: this.yoloResult,
    };
    this.emit("frame", this.snapshot);
    // Move, EyeSpeak and the eye cursor read raw landmarks (pose/hands, or the 478 face points with irises).
    if (this.activeModule === "move" || this.activeModule === "eyespeak" || this.gazeCursor) this.emitLandmarks(d, analysis);
    this.draw();
  }
  /**
   * Everything the models returned for this moment, one person: up to 33 pose + 478 face + 21 per
   * hand landmarks, each with the timestamp of the frame it came from. Nothing is interpolated:
   * a modality that wasn't detected is null or empty. Frames never leave the device.
   */
  emitLandmarks(d, analysis) {
    const pose = this.poseResult;
    const hands = (this.handResult?.landmarks || []).map((landmarks, i) => ({
      landmarks,
      handedness: this.handResult.handedness?.[i]?.[0]?.categoryName ?? this.handResult.handednesses?.[i]?.[0]?.categoryName ?? null,
      score: this.handResult.handedness?.[i]?.[0]?.score ?? this.handResult.handednesses?.[i]?.[0]?.score ?? null,
    }));
    this.emit("landmarks", {
      timestampMs: d.t,
      videoSize: { width: this.video.videoWidth || 1, height: this.video.videoHeight || 1 },
      pose: pose?.landmarks?.[0] ?? null,
      poseWorld: pose?.worldLandmarks?.[0] ?? null,
      poseAt: this.poseResultAt ?? null,
      personCount: pose?.landmarks?.length ?? 0,
      face: d.face.faceLandmarks?.[0] ?? null,
      faceAt: d.t,
      faceValid: !!analysis?.valid,
      head: { yaw: analysis?.head?.yaw ?? 0, pitch: analysis?.head?.pitch ?? 0 },
      blendshapes: this.snapshot.blendshapes,
      hands,
      handsAt: this.handResultAt ?? null,
      processingMs: Math.round(d.ms * 10) / 10,
      luma: this.luma ?? null,
      facing: this.facingMode || "user",
      models: { pose: this.posePeriod <= 100 ? "fast" : "slow", hands: this.handsPriority ? "fast" : "slow", face: "on" },
    });
  }
  consumeHands(hand, t) {
    if (hand) {
      this.emit("handframe", { result: hand, t });
      this.cycles.hand++;
      this.handResult = hand;
      this.handResultAt = t;
      this.handTracks ??= new HandTracks();
      const hands = this.handTracks.update(
        NF_fingerspeakSignal.orderedHands(hand),
        t,
      );
      this.hands = this.handTracker.update(hands, t);
      const seen = new Set();
      for (const h of this.hands) {
        seen.add(h.id);
        if (this.handStates[h.id] !== h.pose && h.pose !== "Observing…")
          this.emit("hand", { ...h, t });
        this.handStates[h.id] = h.pose;
      }
      for (const k of Object.keys(this.handStates))
        if (!seen.has(k)) delete this.handStates[k];
    }
    this.snapshot.hands = this.hands || [];
    this.snapshot.cycles = { ...this.cycles };
  }
  /**
   * How old a face landmark ROI may be before its colour sample is rejected.
   *
   * The bound is 600 ms, or three observed face-result intervals on a device
   * whose face results arrive slowly. A fixed 600 ms is only 1.8 intervals on
   * a 3 Hz device, where one late face result would invalidate the vital
   * signal for no reason. The bound is never tightened below the observed
   * interval, and it is never shorter than it was before.
   */
  roiFreshnessMs() {
    this.observeFaceResultAt();
    return Math.max(600, 3 * (this.faceResultIntervalMs || 0));
  }
  /** Track the interval between face results, so a slow cadence is not read as stale. */
  observeFaceResultAt() {
    const at = this.faceResultAt || 0;
    if (!at || at === this.observedFaceResultAt) return;
    if (this.observedFaceResultAt) {
      const interval = at - this.observedFaceResultAt;
      if (interval > 0) {
        this.faceResultIntervalMs = this.faceResultIntervalMs
          ? this.faceResultIntervalMs * 0.7 + interval * 0.3
          : interval;
      }
    }
    this.observedFaceResultAt = at;
  }
  samplePulse(result, f, t) {
    const lm = result?.faceLandmarks?.[0];
    if (!lm || !f?.facePresent || f.faceQuality < 0.65 || t - (this.faceResultAt || 0) > this.roiFreshnessMs()) {
      this.pulse = this.vitals.invalidate("Position your face in frame, centered and well-lit", t);
      this.snapshot.pulse = this.pulse;
      return;
    }
    this.roi ??= Object.assign(document.createElement("canvas"), {
      width: 16,
      height: 16,
    });
    const c = this.roiContext ??= this.roi.getContext("2d", { willReadFrequently: true });
    const W = this.video.videoWidth,
      H = this.video.videoHeight;
    // Landmarks change much less often than camera color frames. Recompute
    // geometry only for a new observed face result or video dimensions.
    if (this.pulseGeometry?.landmarks !== lm || this.pulseGeometry.width !== W || this.pulseGeometry.height !== H) {
      this.pulseGeometry = { landmarks: lm, width: W, height: H, rois: vitalROIs(lm, W, H), headY: lm.reduce((sum, p) => sum + p.y, 0) / lm.length };
    }
    const rois = this.pulseGeometry.rois, rgbSum = [0, 0, 0], boxes = [];
    let roiCount = 0;
    for (const rect of rois) {
      c.drawImage(this.video, rect.x, rect.y, rect.w, rect.h, 0, 0, 16, 16);
      const px = c.getImageData(0, 0, 16, 16).data, rgb = [0, 0, 0];
      for (let i = 0; i < px.length; i += 4) {
        rgb[0] += px[i]; rgb[1] += px[i + 1]; rgb[2] += px[i + 2];
      }
      const divisor = px.length / 4 * 255;
      for (let k = 0; k < 3; k++) rgb[k] /= divisor;
      const brightness = (rgb[0] + rgb[1] + rgb[2]) / 3;
      const accepted = brightness > .08 && brightness < .95;
      boxes.push({ x: rect.x / W, y: rect.y / H, w: rect.w / W, h: rect.h / H, valid: accepted });
      if (accepted) { roiCount++; for (let k = 0; k < 3; k++) rgbSum[k] += rgb[k]; }
    }
    if (!roiCount) this.pulse = this.vitals.invalidate("Skin regions are too dark, hidden, or overexposed", t);
    else this.pulse = this.vitals.add({
      t,
      rgb: rgbSum.map(v => v / roiCount),
      headY: this.pulseGeometry.headY,
      motion: this.vitalsMotion || 0,
      roiCount,
    });
    this.pulse = { ...this.pulse, rois: boxes };
    this.snapshot.pulse = this.pulse;
  }
  draw() {
    if (!this.canvas.offsetParent) return;
    // Move draws its own exercise-aware overlay, and EyeSpeak its own eye and iris outline, both aligned
    // to the on-screen crop.
    if (this.activeModule === "move" || this.activeModule === "eyespeak") {
      if (!this.overlayCleared) this.canvas.getContext("2d")?.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.overlayCleared = true;
      return;
    }
    this.overlayCleared = false;
    const c = this.overlayContext ??= this.canvas.getContext("2d"),
      W = this.video.videoWidth || 640,
      H = this.video.videoHeight || 480;
    if (this.canvas.width !== W) this.canvas.width = W;
    if (this.canvas.height !== H) this.canvas.height = H;
    c.clearRect(0, 0, W, H);
    if (this.activeModule === "vitalsense") {
      c.lineWidth = 2;
      for (const r of this.pulse.rois || []) {
        c.strokeStyle = r.valid ? "#21e6c1" : "#ffb454";
        c.strokeRect(r.x * W, r.y * H, r.w * W, r.h * H);
      }
    }
    const lines = (lm, edges, color) => {
      if (!lm) return;
      c.strokeStyle = color;
      c.lineWidth = 2;
      for (const [a, b] of edges) {
        if (!lm[a] || !lm[b]) continue;
        c.beginPath();
        c.moveTo(lm[a].x * W, lm[a].y * H);
        c.lineTo(lm[b].x * W, lm[b].y * H);
        c.stroke();
      }
    };
    for (const lm of this.handResult?.landmarks || [])
      lines(
        lm,
        [
          [0, 1],
          [1, 2],
          [2, 3],
          [3, 4],
          [0, 5],
          [5, 6],
          [6, 7],
          [7, 8],
          [5, 9],
          [9, 10],
          [10, 11],
          [11, 12],
          [9, 13],
          [13, 14],
          [14, 15],
          [15, 16],
          [13, 17],
          [17, 18],
          [18, 19],
          [19, 20],
          [0, 17],
        ],
        "#ffcb74",
      );
    lines(
      this.poseResult?.landmarks?.[0],
      [
        [11, 12],
        [11, 13],
        [13, 15],
        [12, 14],
        [14, 16],
        [11, 23],
        [12, 24],
        [23, 24],
        [23, 25],
        [25, 27],
        [24, 26],
        [26, 28],
      ],
      "#63e5c4",
    );
    lines(
      this.faceResult?.faceLandmarks?.[0],
      [
        [33, 160],
        [160, 158],
        [158, 133],
        [133, 153],
        [153, 144],
        [144, 33],
        [362, 385],
        [385, 387],
        [387, 263],
        [263, 373],
        [373, 380],
        [380, 362],
        [61, 13],
        [13, 291],
        [291, 14],
        [14, 61],
      ],
      "#b1a0ff",
    );
    const faceLm = this.faceResult?.faceLandmarks?.[0];
    for (const ids of [NF_LM.browL, NF_LM.browR, NF_LM.contour]) {
      lines(
        faceLm,
        ids.slice(1).map((id, i) => [ids[i], id]),
        "#63e5c4",
      );
    }
  }
  async enableYolo() {
    if (this.yoloWorker) {
      this.yoloEnabled = !this.yoloEnabled;
      return this.yoloEnabled;
    }
    this.emit("status", "Loading YOLO posture cross-check…");
    this.yoloWorker = new Worker(new URL("./yolo-worker.js", import.meta.url), {
      type: "module",
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("YOLO initialization timed out")),
        45000,
      );
      this.yoloWorker.onmessage = ({ data: d }) => {
        if (d.type === "ready") {
          clearTimeout(timer);
          resolve();
        }
        if (d.type === "error") {
          clearTimeout(timer);
          this.yoloBusy = false;
          reject(Error(d.message));
          this.emit(
            "status",
            "YOLO unavailable · lightweight pose remains active",
          );
        }
        if (d.type === "result") {
          this.yoloBusy = false;
          this.yoloResult = d;
        }
      };
      this.yoloWorker.onerror = () => {
        clearTimeout(timer);
        reject(Error("YOLO worker failed"));
      };
      this.yoloWorker.postMessage({ type: "init" });
    });
    this.yoloEnabled = true;
    return true;
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.video.srcObject = null;
    this.worker?.terminate();
    this.worker = null;
    this.handWorker?.terminate();
    this.handWorker = null;
    this.handBusy = false;
    this.lastHandTime = this.lastTime = null;
    this.lastHandFrame = this.lastFrame = 0;
    for (const m of [this.face, this.hand, this.pose]) m?.close();
    this.face = this.hand = this.pose = null;
    this.yoloWorker?.terminate();
    this.yoloWorker = null;
    this.yoloEnabled = false;
    this.busy = false;
    this.rest.reset();
    this.analysis.reset();
    this.invalidateVitals("Monitoring paused");
    this.lastPulseVideoTime = null;
    this.lastPulseFrame = 0;
    this.faceResultAt = 0;
    this.poseResult = this.handResult = null;
    this.poseResultAt = this.handResultAt = null;
    this.luma = null;
    this.pulseGeometry = null;
    this.emit("status", "Monitoring paused");
  }
  // stop() is intentionally reusable for module navigation. destroy() is only
  // for the owning React provider unmounting, so its document listener cannot
  // retain an obsolete engine instance.
  destroy() {
    this.stop();
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  }
}
