// Shapes produced by the browser engine (public/engine). Only fields the UI reads are typed.
export type PulseValue = {
  bpm: number | null;
  breathingBpm: number | null;
  quality: number;
  confidence: number;
  status: "waiting" | "poor" | "fair" | "good" | string;
  reason: string;
  signal?: number[];
  trend: { t: number; bpm: number; quality: string }[];
  readings?: unknown[];
  hrv?: { rmssd?: number; meanIbi?: number; reason?: string };
  baseline?: { bpm: number | null; low: number | null; high: number | null; progress: number; calibrating: boolean };
  windowSeconds?: number;
};

export type Posture = { valid: boolean; label: string; motion: number; sideways?: boolean; lean?: number; tilt?: number };

export type Hand = { id: string; label: string; pose: string; openness?: number[] };

export type FrameSnapshot = {
  raw?: Record<string, number>;
  face?: { accepted?: boolean; smile?: { smileDetected?: boolean; smileIntensity?: number } };
  analysis?: {
    valid?: boolean;
    ready?: boolean;
    eye?: { total?: number };
    head?: { yaw?: number; pitch?: number; roll?: number; nodRecent?: boolean };
    smile?: { intensity?: number; symmetry?: number; state?: string };
    /**
     * One-sided lip pull against the resting face: deviation and threshold in face widths (lateral
     * shift 0.035, corner asymmetry 0.04); duration counts seconds held on the same side, and latched
     * is set once it reaches the 60-second limit.
     */
    lip?: { gesture?: string; active?: boolean; kind?: string; deviation?: number; threshold?: number; side?: "left" | "right"; duration?: number; latched?: boolean };
    neutralProgress?: number;
    au?: { values?: Record<string, number> };
    reason?: string;
  };
  blendshapes?: Record<string, number>;
  posture?: Posture;
  hands?: Hand[];
  pulse?: PulseValue;
  latency?: number;
  blinks?: number;
  activity?: string;
  t?: number;
};

export interface PerceptionInstance extends EventTarget {
  running: boolean;
  stream?: MediaStream;
  neuralHandActive?: boolean;
  snapshot: FrameSnapshot;
  pulse: PulseValue;
  start(): Promise<void>;
  stop(): void;
  setActiveModule(name: string): void;
  setCalibration(baseline: unknown, enabled?: string[]): void;
  resetFaceReference(): void;
  resetVitalsBaseline(): void;
  resetVitalsSession(): void;
  enableYolo?(): Promise<void>;
  /** Move's model router: which landmark models run at full rate. */
  setMoveTracking?(modules: { pose?: boolean; hands?: boolean }): void;
  /** Eye cursor on: face points on every page, and only the face model where hands and body aren't needed. */
  setGazeCursor?(on: boolean): void;
  /** Swap between the front ("user") and back ("environment") camera; resolves to the one in use. */
  setFacingMode?(facing: "user" | "environment"): Promise<string>;
}

export type Landmark = { x: number; y: number; z?: number; visibility?: number; presence?: number };
/** One moment of everything the models returned for one person (engine "landmarks" event, Move and EyeSpeak). */
export type FrameLandmarks = {
  timestampMs: number;
  videoSize: { width: number; height: number };
  pose: Landmark[] | null;
  poseWorld?: Landmark[] | null;
  poseAt: number | null;
  personCount: number;
  face: Landmark[] | null;
  faceAt: number;
  faceValid: boolean;
  head: { yaw: number; pitch: number };
  blendshapes?: Record<string, number>;
  hands: { landmarks: Landmark[]; handedness: string | null; score: number | null }[];
  handsAt: number | null;
  processingMs: number;
  luma: number | null;
  facing?: string;
  models?: { pose: string; hands: string; face: string };
};

export type Assessment = Record<
  "leftHand" | "rightHand" | "wrist" | "fingers" | "eyes" | "lips" | "head" | "speech",
  "none" | "limited" | "reliable"
> & { canSee: boolean; canHear: boolean };
