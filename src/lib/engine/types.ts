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
    lip?: { gesture?: string; active?: boolean; kind?: string };
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
}

export type Assessment = Record<
  "leftHand" | "rightHand" | "wrist" | "fingers" | "eyes" | "lips" | "head" | "speech",
  "none" | "limited" | "reliable"
> & { canSee: boolean; canHear: boolean };
