import { EyeIcon, HandIcon, HeartIcon, KeyboardIcon, MicIcon, MoveIcon, NutritionIcon, PostureIcon } from "@/components/ui/icons";
import type { ModuleKey } from "@/content/landing";

const map = { facespeak: EyeIcon, eyespeak: KeyboardIcon, fingerspeak: HandIcon, senseassist: MicIcon, vitalsense: HeartIcon, posture: PostureIcon, move: MoveIcon, nutrition: NutritionIcon };

export function ModuleIcon({ module, size }: { module: ModuleKey; size?: number }) {
  const Icon = map[module];
  return <Icon size={size} />;
}
