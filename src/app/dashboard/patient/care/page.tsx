"use client";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmbeddedTool } from "@/components/patient/EmbeddedTool";

export default function CarePage() {
  return (
    <>
      <PageHeader title="Care journal" description="Note how you feel, check for warning signs, and prepare a summary for your next visit. Entries stay on this device unless you choose to share them with Asha." />
      <EmbeddedTool route="care" title="Care journal" />
    </>
  );
}
