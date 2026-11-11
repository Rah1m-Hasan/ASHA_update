"use client";

import Link from "next/link";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmbeddedTool } from "@/components/patient/EmbeddedTool";

export default function EyeSpeakKeyboardPage() {
  return (
    <>
      <PageHeader
        title="Spell a message"
        description="Build a message from English or Bangla letters, phrases and word suggestions, then Asha says it aloud. Use touch, or a single switch with the Space key."
        actions={
          <Link href="/dashboard/patient/eyespeak" className="inline-flex min-h-9 items-center rounded-full bg-brand-soft px-3 py-2 text-sm font-medium text-brand hover:bg-brand-mint">
            Look to choose instead
          </Link>
        }
      />
      <EmbeddedTool route="eyespeak" title="Spell a message" />
    </>
  );
}
