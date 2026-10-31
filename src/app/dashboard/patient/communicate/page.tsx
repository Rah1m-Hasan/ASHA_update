"use client";

import { useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { DeliveryBanner } from "@/components/patient/DeliveryBanner";
import { NeedButtons } from "@/components/patient/NeedButtons";
import { RequestList } from "@/components/patient/RequestTimeline";
import { Button } from "@/components/ui/Button";
import { useRequests } from "@/features/requests/RequestProvider";
import { usePatientProfile } from "@/features/session/usePatientProfile";
import { speak } from "@/features/speech/speak";

const PHRASES = ["Yes", "No", "Thank you", "I’m in pain", "I’m cold", "I’m tired", "Please wait", "Turn off the light"];

export default function CommunicatePage() {
  const { propose } = useRequests();
  const { data, isLocalDemo } = usePatientProfile();
  const [message, setMessage] = useState("");

  return (
    <>
      <PageHeader title="Ask for help" description="Every request asks you to confirm before it reaches your caregiver." />
      <DeliveryBanner />
      <section className="mb-8">
        <NeedButtons />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Say something" description="Asha speaks it aloud. Send it to your caregiver if you like.">
          <div className="flex flex-wrap gap-2">
            {PHRASES.map((p) => (
              <button key={p} onClick={() => speak(p)} className="rounded-full bg-brand-soft px-4 py-2 font-medium text-brand hover:bg-brand-mint">
                {p}
              </button>
            ))}
          </div>
          <form
            className="mt-5"
            onSubmit={(e) => {
              e.preventDefault();
              const text = message.trim();
              if (text) propose("message", text.slice(0, 250));
            }}
          >
            <label htmlFor="message" className="text-sm font-medium text-ink">
              Your own message
            </label>
            <textarea
              id="message"
              rows={3}
              maxLength={250}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-2 w-full rounded-xl border border-line p-3 text-lg focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
              placeholder="Type a message"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => message.trim() && speak(message)}>
                Speak it
              </Button>
              <Button type="submit" disabled={!message.trim()}>
                Send to caregiver
              </Button>
            </div>
          </form>
        </Panel>

        <Panel title="Request history">
          {isLocalDemo ? <p className="py-6 text-center text-sm text-muted">Link a caregiver to see delivery status here.</p> : <RequestList events={data?.events ?? []} limit={20} />}
        </Panel>
      </div>
    </>
  );
}
