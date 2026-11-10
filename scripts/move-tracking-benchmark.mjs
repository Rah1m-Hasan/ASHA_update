// Move tracking benchmark: what each model-router mode costs per camera frame, measured with the
// real MediaPipe models in headless Chromium, and how many landmarks each returns on a real image.
//
//   node scripts/move-tracking-benchmark.mjs <person-image.jpg> [holistic_landmarker.task]
//
// Needs the dev server (NEXT_TEST_URL, default http://127.0.0.1:4180) for the shipped models and the
// MediaPipe bundle. The holistic model is not shipped with ASHA; pass a local copy to compare it.
// Results go to artifacts/move-tracking-benchmark.json (or BENCH_OUT). Nothing leaves this machine.
import fs from "node:fs/promises";
import os from "node:os";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fingerOpenness } from "../src/features/move/detectors.js";
import { assessFrame, landmarkCounts, palmSize } from "../src/features/move/tracking.js";

const [imagePath, holisticPath] = process.argv.slice(2);
if (!imagePath) {
  console.error("usage: node scripts/move-tracking-benchmark.mjs <person-image.jpg> [holistic_landmarker.task]");
  process.exit(2);
}
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.NEXT_TEST_URL || "http://127.0.0.1:4180";
const FRAMES = Number(process.env.BENCH_FRAMES || 60);
const WARMUP = 10;

const sha = (b) => createHash("sha256").update(b).digest("hex");
const image = await fs.readFile(imagePath);
const holistic = holisticPath ? await fs.readFile(holisticPath) : null;
const shipped = {
  pose: "public/models/pose_landmarker_lite.task",
  face: "public/neuroface/models/face_landmarker.task",
  hands: "public/neuroface/models/hand_landmarker.task",
};
const sizes = {};
for (const [k, p] of Object.entries(shipped)) sizes[k] = (await fs.stat(new URL(`../${p}`, import.meta.url))).size;
if (holistic) sizes.holistic = holistic.byteLength;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true, args: ["--no-sandbox", "--no-proxy-server"] });
const page = await browser.newPage();
await page.route("**/__bench/person.jpg", (r) => r.fulfill({ contentType: "image/jpeg", body: image }));
if (holistic) await page.route("**/__bench/holistic.task", (r) => r.fulfill({ contentType: "application/octet-stream", body: holistic }));
await page.goto(base + "/manifest.webmanifest").catch(() => page.goto(base));

const result = await page.evaluate(
  async ({ FRAMES, WARMUP, withHolistic }) => {
    const V = await import("/neuroface/vendor/vision_bundle.mjs");
    const files = await V.FilesetResolver.forVisionTasks(new URL("/neuroface/vendor/wasm/", location.href).href);
    const make = (Type, path, extra) => Type.createFromOptions(files, { runningMode: "VIDEO", baseOptions: { delegate: "CPU", modelAssetPath: path }, ...extra });
    const t0 = performance.now();
    const pose = await make(V.PoseLandmarker, "/models/pose_landmarker_lite.task", { numPoses: 1, minPoseDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });
    const face = await make(V.FaceLandmarker, "/neuroface/models/face_landmarker.task", { numFaces: 1, outputFaceBlendshapes: true, minFaceDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });
    const hands = await make(V.HandLandmarker, "/neuroface/models/hand_landmarker.task", { numHands: 2, minHandDetectionConfidence: 0.55, minTrackingConfidence: 0.55 });
    const loadMs = performance.now() - t0;
    let holistic = null, holisticLoadMs = null;
    if (withHolistic && V.HolisticLandmarker) {
      const h0 = performance.now();
      holistic = await make(V.HolisticLandmarker, "/__bench/holistic.task", { outputFaceBlendshapes: true });
      holisticLoadMs = performance.now() - h0;
    }

    // The person, letterboxed into a 640x480 camera frame exactly as a webcam would deliver it.
    const img = new Image();
    img.src = "/__bench/person.jpg";
    await img.decode();
    const canvas = Object.assign(document.createElement("canvas"), { width: 640, height: 480 });
    const ctx = canvas.getContext("2d");
    const frames = {
      person: () => {
        ctx.fillStyle = "#777";
        ctx.fillRect(0, 0, 640, 480);
        const s = Math.min(640 / img.width, 480 / img.height), w = img.width * s, h = img.height * s;
        ctx.drawImage(img, (640 - w) / 2, (480 - h) / 2, w, h);
      },
      empty: () => {
        ctx.fillStyle = "#777";
        ctx.fillRect(0, 0, 640, 480);
      },
    };
    let ts = 1000;
    const stats = (xs) => {
      const s = [...xs].sort((a, b) => a - b), q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
      return { n: s.length, mean: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2) };
    };
    // One frame of each router mode. Returns the landmark output of the last frame.
    const modes = {
      pose_only: () => ({ pose: pose.detectForVideo(canvas, ts) }),
      face_only: () => ({ face: face.detectForVideo(canvas, ts) }),
      hands_only: () => ({ hands: hands.detectForVideo(canvas, ts) }),
      // What ASHA runs for a body exercise: face every frame (AAC requests), pose at camera rate, hands every 8th frame (~250 ms).
      router_body: (i) => ({ face: face.detectForVideo(canvas, ts), pose: pose.detectForVideo(canvas, ts), hands: i % 8 === 0 ? hands.detectForVideo(canvas, ts) : null }),
      // A face exercise: face every frame, pose and hands at their slow 500 / 250 ms cadence.
      router_face: (i) => ({ face: face.detectForVideo(canvas, ts), pose: i % 15 === 0 ? pose.detectForVideo(canvas, ts) : null, hands: i % 8 === 0 ? hands.detectForVideo(canvas, ts) : null }),
      // "Show all detected landmarks": all three models every frame (ASHA's composite holistic).
      composite_all: () => ({ face: face.detectForVideo(canvas, ts), pose: pose.detectForVideo(canvas, ts), hands: hands.detectForVideo(canvas, ts) }),
    };
    if (holistic) modes.holistic_model = () => ({ holistic: holistic.detectForVideo(canvas, ts) });
    const out = {};
    for (const [input, paint] of Object.entries(frames)) {
      out[input] = {};
      for (const [name, run] of Object.entries(modes)) {
        paint();
        const times = [];
        let last = null;
        for (let i = 0; i < WARMUP + FRAMES; i++) {
          ts += 33;
          const a = performance.now();
          last = run(i);
          const ms = performance.now() - a;
          if (i >= WARMUP) times.push(ms);
        }
        const plain = (lms) => (lms ?? []).map((l) => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility }));
        const lm = {
          pose: last.pose ? plain(last.pose.landmarks?.[0]) : last.holistic ? plain(last.holistic.poseLandmarks?.[0]) : null,
          face: last.face ? plain(last.face.faceLandmarks?.[0]) : last.holistic ? plain(last.holistic.faceLandmarks?.[0]) : null,
          hands: last.hands
            ? (last.hands.landmarks ?? []).map((l, k) => ({ landmarks: plain(l), handedness: last.hands.handedness?.[k]?.[0]?.categoryName ?? null }))
            : last.holistic
              ? [["Left", last.holistic.leftHandLandmarks?.[0]], ["Right", last.holistic.rightHandLandmarks?.[0]]].filter(([, l]) => l?.length).map(([h, l]) => ({ landmarks: plain(l), handedness: h }))
              : [],
        };
        out[input][name] = { ms: stats(times), landmarks: lm };
      }
    }
    return { loadMs: +loadMs.toFixed(0), holisticLoadMs: holisticLoadMs && +holisticLoadMs.toFixed(0), out, ua: navigator.userAgent, threads: navigator.hardwareConcurrency };
  },
  { FRAMES, WARMUP, withHolistic: !!holistic },
);
await browser.close();

// Landmark counts per mode, and what ASHA's own checks make of them (status for a squat and a
// smile, and the finger-openness signal used for finger opening on each detected hand).
const report = {
  generatedAt: new Date().toISOString(),
  environment: { node: process.version, platform: `${os.platform()} ${os.release()}`, cpu: os.cpus()[0]?.model ?? "unknown", cores: os.cpus().length, browser: result.ua, browserThreads: result.threads, delegate: "CPU (WASM), headless Chromium" },
  input: { image: imagePath.split("/").pop(), sha256: sha(image), frame: "640x480, letterboxed", framesMeasured: FRAMES, warmupFrames: WARMUP },
  modelBytes: sizes,
  modelLoadMs: { shipped: result.loadMs, holistic: result.holisticLoadMs },
  modes: {},
};
for (const [input, modes] of Object.entries(result.out)) {
  report.modes[input] = {};
  for (const [name, r] of Object.entries(modes)) {
    const t = 1000;
    const frame = { timestampMs: t, videoSize: { width: 640, height: 480 }, pose: r.landmarks.pose?.length ? r.landmarks.pose : null, poseAt: t, personCount: r.landmarks.pose?.length ? 1 : 0, face: r.landmarks.face?.length ? r.landmarks.face : null, faceAt: t, faceValid: !!r.landmarks.face?.length, head: { yaw: 0, pitch: 0 }, blendshapes: { mouthSmileLeft: 0 }, hands: r.landmarks.hands, handsAt: t, luma: 0.5 };
    report.modes[input][name] = {
      ms: r.ms,
      landmarks: landmarkCounts(frame),
      squatStatus: assessFrame(frame, "squat", { now: t }).status,
      armRaiseStatus: assessFrame(frame, "arm_raise", { now: t }).status,
      smileStatus: assessFrame(frame, "smile", { now: t }).status,
      hands: r.landmarks.hands.map((h) => ({ handedness: h.handedness, openness: +(fingerOpenness(h.landmarks, 640, 480) ?? NaN).toFixed(2), palm: +palmSize(h.landmarks, { width: 640, height: 480 }).toFixed(3) })),
    };
  }
}
await fs.mkdir(new URL("../artifacts/", import.meta.url), { recursive: true });
const outName = process.env.BENCH_OUT || "move-tracking-benchmark.json";
await fs.writeFile(new URL(`../artifacts/${outName}`, import.meta.url), JSON.stringify(report, null, 2));
const row = (name, m) => `${name.padEnd(16)} p50 ${String(m.ms.p50).padStart(6)} ms  p95 ${String(m.ms.p95).padStart(6)} ms  landmarks ${String(m.landmarks.total).padStart(3)} (pose ${m.landmarks.pose}, face ${m.landmarks.face}, hands ${m.landmarks.hands})  squat ${m.squatStatus}`;
for (const [input, modes] of Object.entries(report.modes)) {
  console.log(`\n${input} frame`);
  for (const [name, m] of Object.entries(modes)) console.log(row(name, m));
}
console.log(`\nModel load: shipped three ${report.modelLoadMs.shipped} ms${holistic ? `, holistic ${report.modelLoadMs.holistic} ms` : ""}. Sizes: ${JSON.stringify(sizes)}`);
console.log(`Hands (composite, person): ${JSON.stringify(report.modes.person.composite_all.hands)}`);
console.log(`Wrote artifacts/${outName}`);
