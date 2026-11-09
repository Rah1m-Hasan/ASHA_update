import {
  ChatIcon,
  EyeIcon,
  HandIcon,
  HeartIcon,
  HomeIcon,
  InboxIcon,
  MicIcon,
  MoveIcon,
  PostureIcon,
  SettingsIcon,
  SparkIcon,
  TargetIcon,
  UserPlusIcon,
  UsersIcon,
} from "@/components/ui/icons";
import type { Role } from "@/features/session/types";

export type NavItem = { href: string; label: string; icon: (p: { size?: number; className?: string }) => React.ReactElement; badge?: "requests" };
export type NavGroup = { label?: string; items: NavItem[] };

const P = "/dashboard/patient";
const C = "/dashboard/caregiver";

export const NAV: Record<Role, NavGroup[]> = {
  patient: [
    {
      items: [
        { href: P, label: "Home", icon: HomeIcon },
        { href: `${P}/communicate`, label: "Ask for help", icon: SparkIcon },
        { href: `${P}/assistant`, label: "Talk to Asha", icon: ChatIcon },
      ],
    },
    {
      label: "Ways to communicate",
      items: [
        { href: `${P}/facespeak`, label: "FaceSpeak", icon: EyeIcon },
        { href: `${P}/fingerspeak`, label: "FingerSpeak", icon: HandIcon },
        { href: `${P}/senseassist`, label: "SenseAssist", icon: MicIcon },
      ],
    },
    {
      label: "Wellbeing",
      items: [
        { href: `${P}/vitalsense`, label: "VitalSense", icon: HeartIcon },
        { href: `${P}/move`, label: "Move", icon: MoveIcon },
        { href: `${P}/posture`, label: "Posture", icon: PostureIcon },
      ],
    },
    {
      label: "Setup",
      items: [
        { href: `${P}/calibration`, label: "Calibration", icon: TargetIcon },
        { href: `${P}/settings`, label: "Settings", icon: SettingsIcon },
      ],
    },
  ],
  caregiver: [
    {
      items: [
        { href: C, label: "Overview", icon: HomeIcon },
        { href: `${C}/requests`, label: "Requests", icon: InboxIcon, badge: "requests" },
        { href: `${C}/patients`, label: "Patients", icon: UsersIcon },
        { href: `${C}/patients/new`, label: "Add patient", icon: UserPlusIcon },
      ],
    },
    { label: "Account", items: [{ href: `${C}/settings`, label: "Settings", icon: SettingsIcon }] },
  ],
};

/** Finds the nav label for the current path (used for the mobile top bar title). */
export function titleFor(role: Role, pathname: string) {
  const items = NAV[role].flatMap((g) => g.items);
  return [...items].sort((a, b) => b.href.length - a.href.length).find((i) => pathname === i.href || pathname.startsWith(i.href + "/"))?.label ?? "Asha";
}
