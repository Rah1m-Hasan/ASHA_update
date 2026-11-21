"use client";

import { useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { buildEnquiryDraft, INTERESTS } from "./enquiry.js";
import { INTEREST_EVENT } from "./interest";

const field =
  "mt-2 block w-full rounded-[14px] border border-line-strong bg-input px-4 py-3 text-base text-ink placeholder:text-muted transition-colors hover:border-brand/50 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15";

type Draft = { emailUrl: string; whatsappUrl: string };

/** Prepares an email or WhatsApp draft. Nothing is stored or sent automatically. */
export function EnquiryForm() {
  const [interest, setInterest] = useState("demo");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    const onInterest = (e: Event) => {
      const value = (e as CustomEvent<string>).detail;
      if (Object.hasOwn(INTERESTS, value)) setInterest(value);
    };
    window.addEventListener(INTEREST_EVENT, onInterest);
    return () => window.removeEventListener(INTEREST_EVENT, onInterest);
  }, []);

  function prepare(form: HTMLFormElement): Draft | null {
    const data = new FormData(form);
    try {
      const d = buildEnquiryDraft({
        name: data.get("name"),
        email: data.get("email"),
        organisation: data.get("organisation"),
        interest,
        message: data.get("message"),
        consent: data.get("consent") === "on",
      });
      setError("");
      setDraft(d);
      return d;
    } catch (err) {
      setError((err as Error).message);
      setDraft(null);
      return null;
    }
  }

  return (
    <form
      className="rounded-[28px] border border-line bg-surface p-6 shadow-panel sm:p-8"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const d = prepare(e.currentTarget);
        if (d) window.location.href = d.emailUrl;
      }}
      onChange={() => {
        if (draft) setDraft(null);
        // Clear the validation message as soon as the person edits a field.
        if (error) setError("");
      }}
    >
      <h3 className="text-[clamp(1.5rem,2.2vw,1.875rem)] leading-[1.2] font-medium text-heading">How can we help?</h3>
      <p className="mt-2 text-[15px] leading-[1.6] text-body">
        Tell us what you want to explore and we’ll come back with a time.
      </p>
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <label className="text-[15px] font-medium text-ink">
          Your name
          <input name="name" required maxLength={100} autoComplete="name" className={field} />
        </label>
        <label className="text-[15px] font-medium text-ink">
          Reply email
          <input name="email" type="email" required maxLength={160} autoComplete="email" className={field} />
        </label>
        <label className="text-[15px] font-medium text-ink">
          Organisation <span className="font-normal text-muted">(optional)</span>
          <input name="organisation" maxLength={120} autoComplete="organization" className={field} />
        </label>
        <label className="text-[15px] font-medium text-ink">
          I’m interested in
          <select name="interest" value={interest} onChange={(e) => setInterest(e.target.value)} className={field}>
            {Object.entries(INTERESTS as Record<string, string>).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[15px] font-medium text-ink sm:col-span-2">
          What would you like to explore?
          <textarea name="message" required rows={4} maxLength={1000} className={field} />
        </label>
      </div>
      <label className="mt-6 flex items-start gap-3 text-[15px] leading-[1.5] text-ink">
        <input name="consent" type="checkbox" className="mt-0 size-6 shrink-0 accent-brand" />
        I agree to be contacted about this enquiry.
      </label>
      {error && (
        <p role="alert" className="mt-4 rounded-[12px] border border-danger/25 bg-danger/5 px-4 py-3 text-[15px] text-danger">
          {error}
        </p>
      )}
      <div className="mt-7 flex flex-wrap gap-3">
        <Button type="submit">Prepare email enquiry</Button>
        <button
          type="button"
          className={buttonClass("outline")}
          onClick={(e) => {
            const d = prepare(e.currentTarget.form!);
            if (d) window.open(d.whatsappUrl, "_blank", "noopener");
          }}
        >
          Use WhatsApp
        </button>
      </div>
      <p className="mt-4 text-[13px] leading-[1.6] text-body">
        Opens an email or WhatsApp draft. Nothing is sent automatically; your booking is not confirmed until the team replies.
      </p>
    </form>
  );
}
