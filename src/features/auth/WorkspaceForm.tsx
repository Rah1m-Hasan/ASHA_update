"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RoleSelect } from "@/components/auth/RoleSelect";
import { Button, buttonClass } from "@/components/ui/Button";
import type { Role } from "@/features/session/types";
import { chooseWorkspace } from "./auth-client";

export function WorkspaceForm({ initialRole }: { initialRole: Role }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(initialRole);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <div className="space-y-6">
      <p className="rounded-2xl bg-brand-soft px-4 py-3 text-sm leading-relaxed text-ink">
        Choose a demo view. This browser remembers your choice. Private patient
        information requires a care-circle access link.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          router.push(chooseWorkspace(role));
        }}
        className="space-y-5"
      >
        <RoleSelect value={role} onChange={setRole} disabled={!ready} />
        <Button
          type="submit"
          className="min-h-12 w-full disabled:opacity-60"
          disabled={!ready}
        >
          Open {role} dashboard
        </Button>
      </form>
      <div className="border-t border-line pt-5">
        <p className="mb-3 text-sm text-muted">
          Already have a private patient or caregiver link?
        </p>
        <Link
          href="/dashboard/link"
          className={buttonClass("secondary", "md", "min-h-12 w-full")}
        >
          Connect with a private link
        </Link>
      </div>
      <nav
        aria-label="Other workspaces"
        className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-medium text-brand"
      >
        <a href="/everyday.html" className="rounded-sm hover:underline">
          Everyday companion ↗
        </a>
        <a href="/assistive.html" className="rounded-sm hover:underline">
          Full assistive app ↗
        </a>
      </nav>
    </div>
  );
}
