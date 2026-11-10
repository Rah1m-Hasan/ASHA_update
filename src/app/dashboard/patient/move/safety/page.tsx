"use client";

import { useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Switch } from "@/components/dashboard/Switch";
import { Button } from "@/components/ui/Button";
import { ChevronIcon } from "@/components/ui/icons";
import { CATALOG_VERSION } from "@/features/move/catalog.js";
import { DETECTOR_VERSION } from "@/features/move/detectors.js";
import { attestAssessment, attestAvailableAt, clearanceValid, lockoutActive, MOVE_SAFETY_VERSION, recordClearance, SESSION_SYMPTOMS } from "@/features/move/safety.js";
import { moveStore, useMove, type Lang, type Lockout } from "@/features/move/store";
import { tx, useNow } from "@/features/move/ui";
import { cn } from "@/lib/cn";

// Measured from the pinned files in public/ (bytes), not estimated.
const MODELS = [
  { name: "Pose Landmarker Lite (body)", file: "/models/pose_landmarker_lite.task", bytes: 5777746 },
  { name: "Face Landmarker (face, blendshapes)", file: "/neuroface/models/face_landmarker.task", bytes: 3758596 },
];

// What each stop rule does, in the order of urgency. The actions themselves live in safety.js and session.js.
const RULES = [
  {
    action: "emergency",
    en: "Stop and get urgent help",
    bn: "থামুন, জরুরি সহায়তা নিন",
    noteEn: "Call 999. Move pauses for 12 hours.",
    noteBn: "৯৯৯ নম্বরে কল করুন। মুভ ১২ ঘণ্টা বন্ধ থাকবে।",
    tone: "text-red-700",
  },
  { action: "stop_rest", en: "Stop and rest", bn: "থামুন, বিশ্রাম নিন", noteEn: "Move pauses for 15 minutes.", noteBn: "মুভ ১৫ মিনিট বন্ধ থাকবে।", tone: "text-amber-800" },
  {
    action: "stop_exercise",
    en: "Stop that exercise",
    bn: "ওই ব্যায়াম থামান",
    noteEn: "ASHA skips it. Don't push through sharp pain.",
    noteBn: "ASHA এটি বাদ দেবে। তীক্ষ্ণ ব্যথা নিয়ে চালিয়ে যাবেন না।",
    tone: "text-ink",
  },
  { action: "end", en: "End gently", bn: "ধীরে শেষ করুন", noteEn: "ASHA moves to a slow cool-down.", noteBn: "ASHA ধীর কুল-ডাউনে যাবে।", tone: "text-ink" },
] as const;

const field = "mt-1 h-11 w-full rounded-xl bg-white px-3 text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-brand";

function Section({ id, title, description, children, className }: { id?: string; title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cn("scroll-mt-24", className)}>
      <h2 id={id ? `${id}-title` : undefined} className="text-base font-semibold text-ink">
        {title}
      </h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-3 rounded-2xl bg-white px-5 ring-1 ring-line">{children}</div>
    </section>
  );
}

function LanguagePicker({ lang }: { lang: Lang }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-4">
      <span className="font-medium text-ink">{tx(lang, "Language", "ভাষা")}</span>
      <div className="inline-flex rounded-full bg-wash p-1 ring-1 ring-line" role="radiogroup" aria-label="Language">
        {(
          [
            ["en", "English"],
            ["bn", "বাংলা"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={lang === id}
            onClick={() => moveStore.set({ language: id })}
            className={cn("h-9 rounded-full px-4 text-sm font-medium transition-colors", lang === id ? "bg-white text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink")}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MoveSafety() {
  const s = useMove((x) => x);
  const lang = s.language;
  const now = useNow(15000);
  const [clear, setClear] = useState({ clinicianName: "", date: "", limits: "" });
  const [attest, setAttest] = useState({ clinicianName: "", confirmed: false });
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const locked = lockoutActive(s.lockout, now);

  function saveClearance(e: React.FormEvent) {
    e.preventDefault();
    try {
      moveStore.set({ clearance: recordClearance({ ...clear, scope: "general" }) });
      setMessage("Clearance recorded. It is labelled as self-reported.");
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  function submitAttestation(e: React.FormEvent) {
    e.preventDefault();
    try {
      moveStore.set({ lockout: attestAssessment(s.lockout, attest) as Lockout });
      setMessage("Recorded. Move is available again. Stop at once if any warning sign returns.");
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  function download() {
    const blob = new Blob([moveStore.export()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `asha-move-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={tx(lang, "Safety", "নিরাপত্তা")}
        description={tx(
          lang,
          "When ASHA stops a workout, your clinician's clearance, and what Move keeps on this device.",
          "কখন ASHA ব্যায়াম থামায়, আপনার চিকিৎসকের অনুমতি, এবং মুভ এই ডিভাইসে কী রাখে।",
        )}
      />
      {message && (
        <p role="status" className="mb-6 rounded-xl bg-brand-soft p-3 text-sm text-ink">
          {message}
        </p>
      )}

      <div className="space-y-10">
        {(locked || s.lockout?.audit?.length) && (
          <Section id="lockout" title={tx(lang, "Safety pause", "নিরাপত্তা বিরতি")}>
            <div className="py-4">
              {locked && s.lockout ? (
                <div className="space-y-3">
                  <p className="text-ink">
                    {s.lockout.kind === "emergency" ? "Move is paused after warning symptoms" : "Move is paused so you can rest"} until {new Date(s.lockout.until).toLocaleString()}.
                  </p>
                  {s.lockout.kind === "emergency" &&
                    (now < attestAvailableAt(s.lockout) ? (
                      <p className="text-sm text-muted">
                        Please get medical help first. If a clinician assesses you, you can record that here from {new Date(attestAvailableAt(s.lockout)).toLocaleTimeString()}.
                      </p>
                    ) : (
                      <form onSubmit={submitAttestation} className="space-y-3">
                        <label className="block text-sm text-ink">
                          Clinician who assessed you
                          <input className={field} value={attest.clinicianName} onChange={(e) => setAttest({ ...attest, clinicianName: e.target.value })} required />
                        </label>
                        <label className="flex items-start gap-3 text-sm text-ink">
                          <input type="checkbox" className="mt-1 size-4" checked={attest.confirmed} onChange={(e) => setAttest({ ...attest, confirmed: e.target.checked })} />
                          <span>A clinician assessed me after these symptoms and said I can exercise.</span>
                        </label>
                        <Button type="submit" size="sm">
                          Record assessment
                        </Button>
                      </form>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted">{tx(lang, "No pause is active.", "কোনো বিরতি চালু নেই।")}</p>
              )}
              {s.lockout?.audit?.length ? (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-ink">Safety record</summary>
                  <ul className="mt-2 space-y-1 text-muted">
                    {s.lockout.audit.map((a, i) => (
                      <li key={i}>
                        {new Date(String(a.at)).toLocaleString()}: {String(a.event).replace(/_/g, " ")}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          </Section>
        )}

        <Section
          title={tx(lang, "When to stop", "কখন থামবেন")}
          description={tx(
            lang,
            "These rules run on this device and decide on their own. No AI answer can override them.",
            "এই নিয়মগুলো এই ডিভাইসেই চলে এবং নিজেই সিদ্ধান্ত নেয়। কোনো AI উত্তর এগুলো বদলাতে পারে না।",
          )}
        >
          <ul className="divide-y divide-line">
            {RULES.map((r) => (
              <li key={r.action} className="grid gap-2 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
                <div>
                  <p className={cn("font-medium", r.tone)}>{tx(lang, r.en, r.bn)}</p>
                  <p className="text-sm text-muted">{tx(lang, r.noteEn, r.noteBn)}</p>
                </div>
                <ul className="space-y-1 text-ink">
                  {SESSION_SYMPTOMS.filter((x: { action: string }) => x.action === r.action).map((x: { id: string; en: string; bn: string }) => (
                    <li key={x.id}>{tx(lang, x.en, x.bn)}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="border-t border-line py-4 text-sm text-muted">
            {tx(
              lang,
              "Having a heart condition doesn't mean you can't exercise. It means your plan should come from your clinician, and warning signs always mean stop.",
              "হৃদরোগ থাকলেই ব্যায়াম নিষেধ নয়। এর মানে প্ল্যান আপনার চিকিৎসকের কাছ থেকে আসবে, আর সতর্ক লক্ষণ দেখা দিলে সবসময় থামবেন।",
            )}
          </p>
        </Section>

        <Section
          id="clearance"
          title={tx(lang, "Clinician clearance", "চিকিৎসকের অনুমতি")}
          description={tx(
            lang,
            "Needed if you have a heart condition, were told to limit exercise, or recently had surgery, a fall, an injury or a birth.",
            "হৃদরোগ থাকলে, ব্যায়াম সীমিত রাখতে বলা হলে, বা সম্প্রতি অস্ত্রোপচার, পড়ে যাওয়া, আঘাত বা সন্তান জন্ম হলে প্রয়োজন।",
          )}
        >
          <div className="py-5">
            {s.clearance && clearanceValid(s.clearance) ? (
              <div className="space-y-2">
                <p className="text-ink">
                  Cleared by <strong>{s.clearance.clinicianName}</strong> on {new Date(s.clearance.date).toLocaleDateString()}.
                </p>
                {s.clearance.limits && <p className="text-sm text-muted">Limits: {s.clearance.limits}</p>}
                <p className="text-xs text-muted">Self-reported. ASHA can&apos;t verify it. Heart-conscious workouts use longer warm-ups and beginner levels.</p>
                <Button size="sm" variant="ghost" onClick={() => moveStore.set({ clearance: null })}>
                  Remove
                </Button>
              </div>
            ) : (
              <form onSubmit={saveClearance} className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-ink">
                  Clinician&apos;s name
                  <input className={field} value={clear.clinicianName} onChange={(e) => setClear({ ...clear, clinicianName: e.target.value })} required />
                </label>
                <label className="block text-sm text-ink">
                  Date they cleared you
                  <input type="date" className={field} value={clear.date} onChange={(e) => setClear({ ...clear, date: e.target.value })} required />
                </label>
                <label className="block text-sm text-ink sm:col-span-2">
                  Any limits they gave (optional)
                  <input className={field} value={clear.limits} onChange={(e) => setClear({ ...clear, limits: e.target.value })} placeholder="e.g. walking and light strength only" />
                </label>
                <div className="sm:col-span-2">
                  <Button type="submit" size="sm">
                    Record clearance
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Section>

        <Section title={tx(lang, "Preferences", "পছন্দ")}>
          <div className="divide-y divide-line">
            <LanguagePicker lang={lang} />
            <div className="py-1">
              <Switch
                checked={s.voice}
                onChange={(v) => moveStore.set({ voice: v })}
                label={tx(lang, "Spoken prompts", "কণ্ঠে নির্দেশনা")}
                description={tx(
                  lang,
                  "Counts, rest timers and warnings are read aloud. They always show on screen too.",
                  "গোনা, বিশ্রামের সময় ও সতর্কতা পড়ে শোনানো হয়। স্ক্রিনেও সবসময় দেখা যায়।",
                )}
              />
            </div>
            <div className="py-1">
              <Switch
                checked={s.cameraConsent}
                onChange={(v) =>
                  moveStore.set((x) => ({ cameraConsent: v, consentAudit: [...x.consentAudit, { at: new Date().toISOString(), event: v ? "camera_on_device_granted" : "camera_revoked" }] }))
                }
                label={tx(lang, "Use the camera to count exercises", "ক্যামেরা দিয়ে গোনা")}
                description={tx(
                  lang,
                  "Video is processed on this device and never uploaded or recorded. Off means workouts start in manual mode.",
                  "ভিডিও এই ডিভাইসেই প্রক্রিয়া হয়, কখনো আপলোড বা রেকর্ড হয় না। বন্ধ থাকলে ব্যায়াম নিজে গোনায় শুরু হবে।",
                )}
              />
            </div>
          </div>
        </Section>

        <Section
          title={tx(lang, "Your data", "আপনার তথ্য")}
          description={tx(
            lang,
            "Plans, workouts and safety answers stay on this device. Nothing is shared unless you share it with a clinician through ASHA Clinic.",
            "প্ল্যান, ব্যায়াম ও নিরাপত্তার উত্তর এই ডিভাইসেই থাকে। ASHA Clinic-এর মাধ্যমে চিকিৎসকের সাথে শেয়ার না করলে কিছুই শেয়ার হয় না।",
          )}
        >
          <div className="py-1">
            <Switch
              checked={s.rememberConditions}
              onChange={(v) => moveStore.set({ rememberConditions: v })}
              label={tx(lang, "Remember my safety answers", "নিরাপত্তার উত্তর মনে রাখুন")}
              description={tx(
                lang,
                "Off: you answer the full safety check before every workout. “Right now” symptoms are always asked.",
                "বন্ধ: প্রতিবার পুরো নিরাপত্তা যাচাই হবে। “এই মুহূর্তের” লক্ষণ সবসময় জিজ্ঞেস করা হয়।",
              )}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line py-4">
            <Button size="sm" variant="secondary" onClick={download}>
              Export my Move data
            </Button>
            {confirmDelete ? (
              <>
                <Button
                  size="sm"
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => {
                    const keep = s.lockout && lockoutActive(s.lockout, Date.now()) ? s.lockout : null;
                    moveStore.clear();
                    // An active safety pause outlives deletion, so deleting data can't restart a workout.
                    if (keep) moveStore.set({ lockout: keep });
                    setConfirmDelete(false);
                    setMessage("Move data deleted from this device.");
                  }}
                >
                  Yes, delete everything
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" className="text-red-700" onClick={() => setConfirmDelete(true)}>
                Delete all Move data
              </Button>
            )}
          </div>
        </Section>

        <details className="group rounded-2xl bg-white ring-1 ring-line">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium text-ink">
            {tx(lang, "Technical details", "কারিগরি তথ্য")}
            <ChevronIcon size={18} className="text-muted transition-transform group-open:rotate-90" />
          </summary>
          <div className="space-y-2 border-t border-line px-5 py-4 text-sm text-muted">
            <p>During a workout, body tracking runs about 20 times a second. On older phones, manual mode saves battery.</p>
            <ul className="space-y-1">
              {MODELS.map((m) => (
                <li key={m.file}>
                  {m.name}: {(m.bytes / 1048576).toFixed(1)} MB, on-device
                </li>
              ))}
            </ul>
            <p className="text-xs">
              Catalog {CATALOG_VERSION} · {DETECTOR_VERSION} · {MOVE_SAFETY_VERSION}. Detectors are demo-level: tested on synthetic movements, not yet against reference video or clinically validated.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
