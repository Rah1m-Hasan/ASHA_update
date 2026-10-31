import { EyeIcon, HandIcon, HeartIcon, MicIcon, PostureIcon } from "@/components/ui/icons";
import type { ModuleKey } from "@/content/landing";

const map = { facespeak: EyeIcon, fingerspeak: HandIcon, senseassist: MicIcon, vitalsense: HeartIcon, posture: PostureIcon };

export function ModuleIcon({ module, size }: { module: ModuleKey; size?: number }) {
  const Icon = map[module];
  return <Icon size={size} />;
}
