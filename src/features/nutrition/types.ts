// TypeScript shapes for the plain-JS Nutrition modules (catalog, engine, interview, scan).
export type Text = { en: string; bn: string };
export type Range = { min: number; max: number | null } | null;
export type NutrientKey = "kcal" | "protein" | "fat" | "carbohydrate" | "fiber" | "sodium";

export type Answer = { choice?: string; value?: number; value2?: number; text?: string; recordId?: string; dishId?: string; dontKnow?: boolean; skipped?: boolean; [k: string]: unknown };
export type Capture = { method: "live_scan" | "upload" | "manual"; modelId?: string; modelVersion?: string; suggestion?: { label: string; score: number } | null; qualityFlags?: string[] };
export type Item = { uid: string; dishId: string; answers: Record<string, Answer>; history: string[]; manualCorrections: unknown[]; capture: Capture; recordId?: string; calculated?: boolean; switchedFrom?: string; reopened?: Record<string, Answer> };

export type Field = Text & { id: string; min: number; max: number; step: number };
export type Option = Text & { id: string; input?: { unit: Text; min: number; max: number; step: number } };
export type Question = { id: string; stage: string; kind?: "text" | "search" | "share" | "fields"; text: Text; help?: Text; options?: Option[]; fields?: Field[]; optional?: boolean; placeholder?: Text };

export type Source = { foodId: string | null; label: Text; description: string; state: string; databaseSource: string; databaseRecordId: string; dataVersion: string | null; verification: string; url: string | null };
export type Component = { foodIds: string[]; role: string; scope: string; grams: Range; potGrams: number | null; nutrients: Record<NutrientKey, Range>; sources: Source[] };
export type ItemResult = {
  uid: string;
  dishId: string;
  label: Text | null;
  status: "estimate" | "range" | "lower_bound" | "uncertain" | "unavailable";
  nutrients: Record<NutrientKey, Range>;
  unknownWhy: Partial<Record<NutrientKey, Text>>;
  components: Component[];
  assumptions: Text[];
  notes: Text[];
  reference: { foodId: string | null; kcal: number; label: Text; databaseRecordId: string | null; perServing?: boolean } | null;
  storage: { frozenFor: string | null; freezerTemp: string | null } | null;
  canonical: Record<string, unknown>;
};
export type Meal = {
  items: ItemResult[];
  status: ItemResult["status"];
  total: Record<NutrientKey, Range>;
  eaten: Record<NutrientKey, Range> | null;
  eatenAnswers: Record<string, string | null>;
  counted: string[];
  excluded: string[];
  dataVersion: string;
  engineVersion: string;
};
export type Suggestion = { dishId: string; label: string; score: number; modelId: string; modelVersion: string; experimental: true };
export type VisionResult = { categories: { label: string; score: number }[]; quality?: { warnings: string[]; brightness: number; sharpness: number }; faceCount: number | null; ms?: number; error?: string; timeout?: boolean; unavailable?: boolean };
