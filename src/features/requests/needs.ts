export type NeedKind = "water" | "food" | "toilet" | "comfort" | "help";

export const NEEDS: { kind: NeedKind; label: string; text: string; bn: string }[] = [
  { kind: "water", label: "Water", text: "I need water", bn: "পানি" },
  { kind: "food", label: "Food", text: "I need food", bn: "খাবার" },
  { kind: "toilet", label: "Toilet", text: "I need to go to the toilet", bn: "টয়লেট" },
  { kind: "comfort", label: "Comfort", text: "I need help getting comfortable", bn: "আরাম" },
  { kind: "help", label: "Come here", text: "Please come here", bn: "এখানে আসুন" },
];

export const EVENT_TEXT: Record<string, string> = {
  ...Object.fromEntries(NEEDS.map((n) => [n.kind, n.text])),
  message: "Message",
  test: "Connection test",
  posture: "Sustained posture change · please check in",
  face_change: "Sustained facial movement change · please check in",
};
