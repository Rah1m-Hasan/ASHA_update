"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LinkConnect } from "@/components/dashboard/LinkConnect";
import { acceptLink } from "@/features/session/actions";

/** Open an invitation fragment, or let someone paste their existing private access link. */
export default function LinkPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!window.location.hash) return;
    try {
      const role = acceptLink(window.location.href);
      history.replaceState(null, "", "/dashboard/link");
      router.replace("/dashboard/" + role);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [router]);
  return (
    <main className="grid min-h-dvh place-items-center bg-wash p-5 sm:p-8">
      <section className="w-full max-w-xl rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <Link
          href="/"
          className="text-sm font-medium text-brand hover:underline"
        >
          ← About Asha
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-heading">
          Connect your care circle
        </h1>
        <p className="mt-3 mb-6 leading-relaxed text-muted">
          Paste the complete private patient or caregiver link provided during
          setup. It contains the access code for that care circle.
        </p>
        <LinkConnect />
        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}
        <p className="mt-6 text-sm leading-relaxed text-muted">
          Need to set up a care circle?{" "}
          <a
            href="/assistive.html?role=caregiver"
            className="font-medium text-brand hover:underline"
          >
            Open caregiver setup
          </a>
          .
        </p>
        <nav
          aria-label="Other workspaces"
          className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-5 text-sm font-medium text-brand"
        >
          <Link href="/dashboard/patient" className="rounded-sm hover:underline">
            Try Asha without a link
          </Link>
        </nav>
      </section>
    </main>
  );
}
