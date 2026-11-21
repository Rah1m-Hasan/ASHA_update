# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

NeuroBridge Asha — a Next.js App Router application for a patient/caregiver pair. A patient communicates requests (blink, gesture, speech, touch) to a caregiver through a shared care circle. It is a **demonstration application, not a validated clinical or emergency monitoring device** — see `docs/CLINICAL_SAFETY_BOUNDARIES.md`.

## Commands

```bash
npm install
npm run dev          # dev server (http://localhost:3000; QA port is 4180)
npm run build && npm start
npm test             # node:test unit suite — tests/*.test.mjs
npm run test:browser # Playwright against a running server
npm run test:everyday
```

- Single unit test: `node --test tests/blink-counter.test.mjs` (the `npm test` script is just `node --test tests/*.test.mjs`).
- Type check: `npx tsc --noEmit -p .` (CI runs this; there is no lint script).
- Local dev without cloud storage: `ASHA_MEMORY_STORE=1 LOCAL_DEV=1 npm run dev` — in-memory store, dev only, cleared on restart.
- Browser tests hard-assert the base URL is `127.0.0.1`/`localhost` and never touch production. They expect the server on `127.0.0.1:4180`; override with `EVERYDAY_TEST_URL`. Playwright/Chrome paths come from `PLAYWRIGHT_MODULE` and `CHROME_PATH` env vars — these point at a machine-specific install, adjust them elsewhere.
- Other scripts: `npm run okf` (compile the knowledge bundle), `npm run eval:retrieval`, `npm run eval:local-llm`, `npm run e2e:n8n` (needs `N8N_BIN`), `npm run benchmark:everyday`.

CI (`.github/workflows/ci.yml`) runs `npm test`, `npx tsc --noEmit -p .`, and a local-model chart check. No secrets or network needed.

## Architecture

Three frontends coexist in one Next app. Getting this straight is the main thing to understand before changing code.

| Surface | Location | Notes |
| --- | --- | --- |
| React dashboard | `src/app/**`, `src/features/**` | Patient + caregiver workspace, App Router |
| Retained assistive app | `public/assistive.html`, `public/engine/**` | Original FaceSpeak/FingerSpeak/VitalSense/SenseAssist/posture app, plain ES modules |
| Everyday workspace | `public/everyday.html`, `public/app/everyday/**` | Nutrition/Move/EyeSpeak/Care/Clinic workspace |

`next.config.mjs` redirects legacy entry paths (`/app`, `/care`, `?module=`, `?role=`) to `/assistive.html`; `/everyday` → `/everyday.html`. Do not "fix" a legacy route in `src/app` — the redirect is the contract.

**Server.** API logic lives in `src/server/handlers/*.js` as Node-style `(req, res)` handlers. `src/server/node-adapter.ts` wraps them into the App Router routes in `src/app/api/*/route.ts` (asha, care, clinic, session, workflow, health, cleanup, mcp). Keep the handler contract; route files should stay thin.

**Storage.** `src/server/lib/common.js` picks the store at import time: memory (`ASHA_MEMORY_STORE=1`, dev only) → Supabase (`SUPABASE_URL` + secret key) → Vercel Blob fallback. It also holds the origin allow-list, the 20,000-character body bound (Clinic keeps 660,000), and `no-store` headers.

**LLM.** `src/server/lib/llm-provider.js` selects `maira` (default), `ollama`, or `maira-local`. MAIRA routes by task — conversation → Gemini Flash, speech → GPT, bilingual → Claude Opus — with a Vercel AI Gateway / free Gemini key backup and a local Ollama fallback. `src/server/lib/asha-orchestrator.js` builds the prompt, runs retrieval, then verifies the structured answer: cited source IDs must exist and proposed actions (module suggestion, caregiver-request proposal) must match the patient's explicit request. **A caregiver request still needs a separate patient confirmation before anything is sent.** The orchestrator is app code around a text API — no undocumented tool-calling.

**Knowledge and retrieval.** `src/server/lib/knowledge.js` holds the canonical guide text. The `okf/*.md` concepts mirror it; `okf/compile.mjs` fails if they drift and regenerates `okf/generated.js` (imported by Vercel at runtime). Retrieval is hybrid: `src/server/lib/retrieval.js` (BM25 + Bangla/English query rewriting, the fallback) and `src/server/lib/hybrid-retrieval.js` (Supabase pgvector + FTS + graph expansion via the `asha-knowledge` edge function). `ASHA_HYBRID_RETRIEVAL=0` keeps everything local.

**Browser engine.** `public/engine/*.js` and `public/neuroface/**` are plain ES modules loaded at runtime, deliberately outside the bundler (`src/lib/engine/load.ts` uses `webpackIgnore`/`turbopackIgnore`). React code imports them through `engineModule()`. Unit tests import the same files directly.

**Client state.** `src/features/*` holds per-domain providers and stores (session, requests, perception, caregiver, home, nutrition, move, eyespeak, risk). `src/components/{ui,dashboard,patient,caregiver,landing,auth,ai}` are the presentational layers; `src/components/ui` and `src/content/landing.ts` are the shared design system and all landing copy.

## Conventions and constraints

- **Secrets stay server-side.** `MAIRA_API_KEY`, `MAIRA_PROJECT_KEY`, `SUPABASE_SECRET_KEY`, `VAPID_*`, `CRON_SECRET`, and the MAIRA profile IDs (`MAIRA_CHAT_PROFILE_ID`, `MAIRA_SPEECH_PROFILE_ID`, `MAIRA_BILINGUAL_PROFILE_ID`) are environment variables only. Never place them in HTML, client bundles, logs, or URL query strings.
- **Clinical honesty is enforced in code.** No fabricated vitals, no automatic emergency calls, no diagnosis claims, no voice-cloning claims. Camera outputs are engineering observations. Do not weaken the safety rules in `public/app/everyday/safety.js` and `companion-safety.js`; urgent preflight runs *before* auth, storage reads, and cloud consent checks.
- **Consent gates** — camera, microphone, cloud chat, evidence saving, and clinic sharing each require explicit user action.
- **Feature flags** (`docs/FEATURE_FLAGS.md`) describe implemented capability, not clinical clearance. Food vision, offline ASR, clinical release, and signed release packs are Off and stay Off without the documented prerequisites.
- **`next dev` rewrites `AGENTS.md`** (the Next.js version-caveat block). That file is regenerated by the tool — keep it in the diff.
- This Next.js version has breaking changes versus older training data. Read `node_modules/next/dist/docs/` before writing Next-specific code.

## Docs worth reading before changing behaviour

`docs/ARCHITECTURE.md` (system map and mermaid flow), `docs/IMPLEMENTATION_STATUS.md` (what actually works vs. its boundary), `docs/CLINICAL_SAFETY_BOUNDARIES.md`, `docs/DATA_PRIVACY.md`, `docs/DEPLOYMENT_NOTES.md`, `docs/WORKFLOWS.md` (n8n caregiver escalation), `docs/RETRIEVAL.md` (RAG pipeline and eval results). Module-specific validation docs (`docs/MOVE_VALIDATION.md`, `docs/NUTRITION_V5.md`, `docs/EYESPEAK_VALIDATION.md`) live alongside.

The README is long and accurate but mixes shipped behaviour with historical narrative; the `docs/` files are the more precise source.
