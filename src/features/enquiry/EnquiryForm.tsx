"use client";

import { useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { buildEnquiryDraft, INTERESTS } from "./enquiry.js";
import { INTEREST_EVENT } from "./interest";

const field =
  "mt-2 block w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

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
      className="rounded-[28px] bg-surface p-6 ring-1 ring-line sm:p-8"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const d = prepare(e.currentTarget);
        if (d) window.location.href = d.emailUrl;
      }}
      onChange={() => draft && setDraft(null)}
    >
      <h3 className="text-2xl font-medium text-ink">How can we help?</h3>
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium text-ink">
          Your name
          <input name="name" required maxLength={100} autoComplete="name" className={field} />
        </label>
        <label className="text-sm font-medium text-ink">
          Reply email
          <input name="email" type="email" required maxLength={160} autoComplete="email" className={field} />
        </label>
        <label className="text-sm font-medium text-ink">
          Organisation <span className="font-normal text-muted">(optional)</span>
          <input name="organisation" maxLength={120} autoComplete="organization" className={field} />
        </label>
        <label className="text-sm font-medium text-ink">
          I’m interested in
          <select name="interest" value={interest} onChange={(e) => setInterest(e.target.value)} className={field}>
            {Object.entries(INTERESTS as Record<string, string>).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-ink sm:col-span-2">
          What would you like to explore?
          <textarea name="message" required rows={4} maxLength={1000} className={field} />
        </label>
      </div>
      <label className="mt-5 flex items-start gap-3 text-sm text-ink">
        <input name="consent" type="checkbox" className="mt-0.5 size-4 accent-brand" />
        I agree to be contacted about this enquiry.
      </label>
      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="submit">Prepare email enquiry</Button>
        <button
          type="button"
          className={buttonClass("secondary")}
          onClick={(e) => {
            const d = prepare(e.currentTarget.form!);
            if (d) window.open(d.whatsappUrl, "_blank", "noopener");
          }}
        >
          Use WhatsApp
        </button>
      </div>
      <p className="mt-4 text-xs text-muted">
        Opens an email or WhatsApp draft. Nothing is sent automatically; your booking is not confirmed until the team replies.
      </p>
    </form>
  );
}
