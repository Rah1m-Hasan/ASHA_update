import { WorkspaceForm } from "./WorkspaceForm";

/** Compatibility entry for /register: choose a local demo view, without creating an account. */
export function RegisterForm() {
  return <WorkspaceForm initialRole="caregiver" />;
}
