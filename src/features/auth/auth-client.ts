import { sessionStore } from "@/features/session/store";
import type { Role } from "@/features/session/types";

/** Saves a browser view preference. Private care access still requires its capability link. */
export function chooseWorkspace(role: Role) {
  sessionStore.setRole(role);
  return "/dashboard/" + role;
}
