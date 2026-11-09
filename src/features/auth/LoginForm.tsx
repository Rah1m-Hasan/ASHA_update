import { WorkspaceForm } from "./WorkspaceForm";

/** Compatibility entry for /login: choose a local demo view, without account authentication. */
export function LoginForm() {
  return <WorkspaceForm initialRole="patient" />;
}
