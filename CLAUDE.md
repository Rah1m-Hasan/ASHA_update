# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

NeuroBridge **Asha** — an assistive-communication app for people with speech, motor and sensory impairments, plus a caregiver dashboard. Next.js App Router + React + Tailwind v4, browser-side MediaPipe/TFLite inference, private server-side storage.

It is a **demonstration app, not a validated clinical device**. See "Claims and safety boundaries" below — that section is binding on all code changes.

## Commands

```sh
npm install
npm run dev                     # Next dev server (default :3000)
npm run build && npm start       # production build + serve
npm test                        # unit tests: node --test tests/*.test.mjs
```

Single unit test file: `node --test tests/blink-counter.test.mjs` (or `node --test tests/<name>.test.mjs`).

Browser tests (Playwright, not installed as a dependency — resolved at runtime):
```sh
PLAYWRIGHT_MODULE=<path-to-playwright> CHROME_PATH=<path-to-chrome> \
  node tests/<name>-browser.mjs
```
They expect a dev server on `http://127.0.0.1:4180` (override with `NEXT_TEST_URL` / `ASHA_TEST_BASE` / `EVERYDAY_TEST_URL`) and write screenshots to `artifacts/` (git-ignored).

Scripts:
- `npm run test:browser` — `tests/browser.mjs`, the two-phone setup → request → receipt → acknowledge journey.
- `npm run test:everyday` — Everyday workspace + offline/service-worker checks.
- `npm run benchmark:everyday` — `scripts/everyday-benchmark.mjs --browser`, model/asset inventory and real CPU/WASM inference.
- `npm run okf` — `okf/compile.mjs`, regenerates `okf/generated.js` from `okf/*.md`. **Run this after editing any OKF markdown.**
- `npm run tokens` — `scripts/tokens.mjs`, writes the one palette to `src/app/globals.css`, `src/app/asha-fonts.css`, `public/app/asha-tokens.css` and `public/app/asha-fonts.css`. **Run this after changing a colour or a font**; `npm run tokens:check` fails if the generated files are stale. Edit the palette in `scripts/tokens.mjs`, never the generated CSS.
- `node scripts/secret-scan.mjs` — scans tracked files for leaked provider/Vercel/Supabase keys. Exits non-zero on findings.

Local dev without cloud storage: `ASHA_MEMORY_STORE=1 LOCAL_DEV=1 npm run dev` (in-memory only, ignored when `NODE_ENV=production`).

## Architecture

Three app surfaces share one Next deployment and one codebase:

| URL | Source | What it is |
|---|---|---|
| `/` | `src/app/page.tsx` + `src/components/landing/` | React marketing landing page |
| `/dashboard/...` | `src/app/dashboard/` + `src/features/` | React patient & caregiver workspace |
| `/assistive.html` | `public/assistive.html`, `public/engine/` | Retained legacy assistive app (FaceSpeak, FingerSpeak, VitalSense, SenseAssist, posture) |
| `/everyday.html` | `public/everyday.html`, `public/app/everyday/` | Retained Everyday companion (Nutrition, Move, EyeSpeak, Care, Clinic) |

`next.config.mjs` redirects every legacy entry (`/app`, `/app.html`, `/modules`, `/care`, `/patient`, `/neuroface`, `?module=`, `?role=`) to `/assistive.html`. Private credentials stay in the URL **fragment** (`#patientId=…&token=…`), never the query string. `src/features/session/LinkCatcher.tsx` picks the fragment up and routes to `/dashboard/<role>`.

### Layers

- `src/app` — App Router pages and thin API route wrappers. API routes only do `toRouteHandler(handler)`.
- `src/server/handlers/*.js` — Node-style `(req, res)` API logic, framework-independent and unit-tested. `src/server/node-adapter.ts` adapts them to Next `Request`/`Response` (enforces the 20,000-char body bound; Clinic uses 660,000).
- `src/server/lib/*.js` — storage, provider, orchestration, retrieval. `src/server/lib/common.js` picks the store: `ASHA_MEMORY_STORE=1` (non-production) → Supabase (if `SUPABASE_URL` + secret set) → Vercel Blob.
- `src/features/<area>` — one directory per feature area, holding client state, hooks and domain logic.
- `src/components/` — `ui/` primitives, `landing/`, `dashboard/`, `patient/`, `caregiver/`, `auth/`.
- `public/engine` — browser inference engine, loaded **at runtime** as ES modules from `/engine/*.js` via `src/lib/engine/load.ts` (`engineModule()` bypasses the bundler). `public/neuroface` holds MediaPipe classic scripts loaded the same way. `public/models` holds pinned weights.

### Shared camera / engine

One camera, one engine for the whole patient app: `src/features/perception/PerceptionProvider.tsx` owns the stream and moves a single `<video>`+`<canvas>` stage between attach hosts, so it survives client-side navigation. Face, two hands, vital colour-pulse and pose all run off that one stream. Engine modules are imported dynamically from `/engine`, never bundled.

### Client state pattern

Feature state uses a tiny external store + `useSyncExternalStore` (see `src/features/move/store.ts`, `src/features/nutrition/store.ts`, `src/features/eyespeak/store.ts`), persisted through `src/lib/storage.ts` under the shared `asha_live_` prefix so data carries over from the legacy engine. Keys are per-feature (`move_v2`, `nutrition_v5`, `eyespeak_v1`).

### Request flow (propose → confirm → send)

`src/features/requests/` — a signal proposes a need, the patient confirms in `ConfirmRequestDialog`, then it is sent. Delivery states are distinct: **sent** (server-stored) → **received** (caregiver dashboard fetched it) → **acknowledged** (caregiver acted). Roles are separate hashed bearer tokens; the server never lets one role act as the other.

### Asha orchestration

`src/server/handlers/asha.js` → `src/server/lib/asha-orchestrator.js` → `maira-provider.js`. The orchestrator picks a provider profile by language, retrieves short excerpts from the `okf/` knowledge bundle (`retrieval.js` over `okf/generated.js`), asks the provider for a structured answer, then checks the format, cited source IDs and that any proposed action matches the patient's explicit request. The only AI-proposed actions are a module suggestion and a caregiver-request proposal; a request still needs separate patient confirmation.

`okf/*.md` are the versioned knowledge concepts; `okf/compile.mjs` validates their frontmatter against `src/server/lib/knowledge.js` and regenerates `okf/generated.js`, which is imported at runtime. Edit the markdown, then run `npm run okf`.

### Language and routing

English → Gemini Flash profile, unclear speech → GPT profile, Bangla/Bangla-English → Claude Opus profile. Overrides: `MAIRA_CHAT_PROFILE_ID`, `MAIRA_SPEECH_PROFILE_ID`, `MAIRA_BILINGUAL_PROFILE_ID` (legacy `MAIRA_GPT_PROFILE_ID` applies to chat only). Simple greetings are answered locally without any provider call.

## Conventions

- **TypeScript for app code**, but the domain-logic modules that the legacy engine shares are plain `.js` with JSDoc types (`src/features/*/catalog.js`, `detectors.js`, `safety.js`, `src/server/**`). Keep a file's existing language when editing it.
- Path alias `@/*` → `src/*`.
- Tailwind v4 with the theme tokens defined once in `scripts/tokens.mjs` and written out to `src/app/globals.css` (`--color-brand`, `--color-ink`, `--color-heading`, `--color-muted`, `--color-line`, `--color-canvas`, `--color-surface`, `--color-wash`, `--color-good`, `--color-warn`, `--color-danger`, and the rest). The values live in `--asha-*` variables under `:root` and `:root[data-theme="dark"]`, so the light and dark themes share one palette and an opacity modifier such as `bg-brand/20` follows the theme. Use those tokens; do not introduce raw colours or a second palette. The legacy apps read the same palette from `public/app/asha-tokens.css`.
- English/Bangla strings live inline or in the feature's own catalogue; the landing copy is centralised in `src/content/landing.ts`.
- Server secrets are environment variables only, read server-side. Never place them in client code, `NEXT_PUBLIC_*`, HTML, logs or URLs.
- `scripts/provision.mjs` and `scripts/provider-check.mjs` contain **Windows absolute paths** (`D:/mairaapi.json`) and are operator helpers for the original workstation — they will not run here as-is.
- `AGENTS.md` warns that the installed Next.js version has breaking changes; read `node_modules/next/dist/docs/` before writing against unfamiliar Next APIs.

## Claims and safety boundaries

These are hard constraints, not preferences. The README and `docs/IMPLEMENTATION_STATUS.md` are the source of truth for what each module actually does.

- **Never fabricate clinical values.** No blood pressure, SpO₂, temperature or ECG. Pulse needs 12 s of continuous observation, breathing 30 s; gaps, frozen frames, poor light and motion clear the reading.
- A posture flag, wake-like pattern or facial asymmetry is **not a diagnosis** and never triggers an automatic emergency call. The app does not place phone calls.
- Facial/blink values are **model signals, not a percentage of ability**. Ordinary blinks never send a request; a request needs an explicit, separate confirmation.
- Camera-derived observations are engineering signals. Web push is best-effort and OS-dependent, not a dispatch service.
- The demo access mechanism (random capability credentials, hashed at rest) is **not identity verification** and not a clinical account system.
- "Consent" gates are explicit in code — cloud assistance, clinic sharing and caregiver requests each require their own confirmation.

Relevant docs: `docs/CLINICAL_SAFETY_BOUNDARIES.md`, `docs/DATA_PRIVACY.md`, `docs/FEATURE_FLAGS.md` (which capabilities are deliberately Off: food vision, offline ASR, clinical release, signed release packs), `docs/IMPLEMENTATION_STATUS.md`, `docs/VALIDATION_PLAN.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT_NOTES.md`.

## Deployment

`vercel.json` declares the Next framework, 60 s duration for `src/app/api/**` and the daily `/api/cleanup` cron. Production needs `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (or the Blob token), `MAIRA_API_KEY`, `MAIRA_PROJECT_KEY`, optional profile IDs, `CRON_SECRET`, and the existing VAPID keys for push. Run `npm run build` before every deploy, and `node scripts/secret-scan.mjs` before pushing.

Supabase schema lives in `supabase/schema.sql` (run once in the SQL Editor; RLS on, no browser roles).
