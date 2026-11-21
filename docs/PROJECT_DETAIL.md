# NeuroBridge Asha — full project detail

A complete walk through the repository: what exists, how it is put together, what each
module actually does, where the boundaries are, and how the public website fits in.

Everything here was read from the code in this repository on the current branch
(`claude/project-thread-gu4sts`, at commit `7a14d54`), plus the landing-page redesign
that is still uncommitted in the working tree. Where a document and the code disagree,
the code wins and the difference is called out.

**Verified during this pass**

| Check | Command | Result |
| --- | --- | --- |
| Unit tests | `npm test` | 401 tests, 401 pass, 0 fail (after `npm install`; the repo ships without `node_modules`) |
| Type check | `npx tsc --noEmit -p .` | Clean |
| Production build | `npm run build` | Passes (Next.js 16.4.3, React 19.3.1). The build prints a Next.js security advisory for the pinned version — see "Open items" at the end |
| Landing page | `playwright-cli` against `next start` on `127.0.0.1:4180` | No console errors, no failed requests, no horizontal overflow at 375/390/768/1024/1280/1440/1920. Every internal link and anchor resolves. All text/background pairs meet WCAG AA (lowest 4.75:1). One `<h1>`, no skipped heading levels, no duplicate ids, every control labelled |
| Colour themes | `playwright-cli` against the same server | The toggle switches the theme and records the preference under `asha_live_theme`; the preference survives a reload, `system` follows the device live, and a fixed preference ignores the device. No console errors, no hydration warning, no text below WCAG AA in either theme, and no horizontal overflow at any of the six widths above. The dashboard, `/login` and `/ai` stay light: the dark tokens are scoped to the landing page |

---

## 1. What this project is

Asha is an assistive communication companion for a patient/caregiver pair. A person who
cannot speak, or who cannot move reliably, signals a need — by blink, by face movement, by
hand gesture, by eye gaze, by voice, or by touch — and Asha turns that signal into a
message the caregiver receives, acknowledges, and can answer.

It is a **demonstration application, not a validated clinical or emergency monitoring
device**. That sentence is not decoration: it is enforced in code
(`public/app/everyday/safety.js`, `public/app/everyday/companion-safety.js`), in the
feature flags (`docs/FEATURE_FLAGS.md`), and in the retrieval and orchestration checks
(`src/server/lib/asha-orchestrator.js`). Camera-derived posture, facial asymmetry, pulse
and breathing are *engineering observations*, not measurements.

Three surfaces live in one Next.js application, and understanding that is the single most
important thing before changing any code.

| Surface | Location | What it is |
| --- | --- | --- |
| React dashboard | `src/app/**`, `src/features/**`, `src/components/**` | The patient and caregiver workspace, App Router, 35 pages |
| Retained assistive app | `public/assistive.html`, `public/engine/**` | The original FaceSpeak / FingerSpeak / VitalSense / SenseAssist / posture app, plain ES modules, deliberately outside the bundler |
| Everyday workspace | `public/everyday.html`, `public/app/everyday/**` | The nutrition / move / eyespeak / care / clinic workspace, also plain ES modules |

`next.config.mjs` redirects the legacy entry paths. `/app`, `/care`, `/app?module=…`,
`/app?role=…` all redirect into `/assistive.html`; `/everyday` redirects to
`/everyday.html`; `/website` redirects to the separate public website. **Do not "fix" a
legacy route inside `src/app`** — the redirect is the contract.

### Live deployments

| Deployment | URL | Notes |
| --- | --- | --- |
| App | `https://neurobridge-asha-live.vercel.app/` | Patient + caregiver workspace, API, PWA |
| Public website | `https://asha-neurobridge-website.vercel.app/` | Separate Vercel project, marketing only — see §12 |
| Source | `https://github.com/mysunatislam/neurobridge-asha-unified-app` | This repository |

---

## 2. Repository map

```
src/
  app/                    Next.js App Router (35 pages + API routes)
    page.tsx              The marketing landing page
    dashboard/            Patient + caregiver workspace
    (auth)/               login, register
    ai/                   "How Asha uses AI" — the public measurement page
    api/*/route.ts        Thin wrappers that call src/server/handlers
  components/
    ui/                   Design system primitives (Button, Container, Section, Reveal, icons…)
    landing/              The landing sections, one component per section
    dashboard/ patient/ caregiver/ auth/ ai/   Presentational layers
  content/landing.ts      Every word of landing copy, plans, team, FAQ, contact
  features/               Per-domain client state (15 domains)
  lib/                    api client, storage helpers, engine loader
  server/
    handlers/*.js         Node-style (req,res) API logic — framework independent
    lib/*.js              Store, provider, retrieval, orchestrator, clinic service
    node-adapter.ts       Runs the handlers inside Next route handlers
    mcp/servers.js        Five MCP servers
  app/globals.css         Tailwind v4 theme tokens
public/
  assistive.html          Retained assistive app entry
  everyday.html           Everyday workspace entry
  engine/*.js             Shared browser inference, calibration, signals, speech
  app/everyday/*.js       Everyday modules + contracts + safety + evidence
  neuroface/**            Original face/hand studio, vendor runtime
  models/                 MediaPipe + ONNX weights, manifest.json
  assets/                 Brand marks, team portraits, kit illustration
okf/                      Eight app guides (Markdown) + compile.mjs + generated.js
docs/                     21 markdown documents + eval JSON
tests/                    77 test files (unit + Playwright browser suites)
scripts/                  Build, eval, benchmark, provisioning helpers
workflows/n8n/            Caregiver escalation workflow definition
supabase/                 schema.sql + 3 migrations + asha-knowledge edge function
```

Rough size by area (lines of code + Markdown):

| Area | Lines |
| --- | --- |
| `src/features` | 10,696 |
| `public/app/everyday` | 8,290 |
| `public/engine` | 5,788 |
| `src/app` | 6,881 |
| `src/server` | 3,998 |
| `src/components` | 2,663 |
| `public/neuroface` | 2,820 |
| `tests` | 13,316 |
| `docs` | 1,252 |

---

## 3. Commands, environment and deployment

### Scripts

```bash
npm install
npm run dev          # dev server, http://localhost:3000 (QA port is 4180)
npm run build && npm start
npm test             # node:test unit suite — tests/*.test.mjs
npm run test:browser # Playwright against a running server
npm run test:everyday
```

Other scripts: `npm run okf` (compile the knowledge bundle), `npm run eval:retrieval`,
`npm run eval:local-llm`, `npm run e2e:n8n` (needs `N8N_BIN`),
`npm run benchmark:everyday`.

A single test: `node --test tests/blink-counter.test.mjs`.
Type check: `npx tsc --noEmit -p .` (CI runs this; there is no lint script).

Local development without cloud storage:

```bash
ASHA_MEMORY_STORE=1 LOCAL_DEV=1 npm run dev
```

The memory store is dev-only, is ignored when `NODE_ENV=production`, and is cleared on
restart.

Browser tests hard-assert that the base URL is `127.0.0.1`/`localhost` and never touch
production. They expect the server on `127.0.0.1:4180`; override with `EVERYDAY_TEST_URL`.
Playwright and Chrome paths come from `PLAYWRIGHT_MODULE` and `CHROME_PATH` and point at
a machine-specific install — adjust them elsewhere.

### Runtime stack

| Package | Version | Role |
| --- | --- | --- |
| `next` | 16.4.3 | App Router, API routes, redirects, headers |
| `react` / `react-dom` | 19.3.1 | UI runtime for the dashboard and landing page |
| `tailwindcss` | 4.3.3 | Styling, via `@theme` tokens in `src/app/globals.css` |
| `typescript` | 5.9.3 | Types for `src/**` |
| `@mlc-ai/web-llm` | 0.2.86 | Optional on-device model in the browser |
| `@modelcontextprotocol/sdk` | 1.32.2 | The five MCP servers |
| `@vercel/blob` | 2.8.0 | Blob storage fallback when Supabase is absent |
| `web-push` | 3.6.7 | Caregiver push notifications |
| `zod` | 4.6.7 | MCP tool argument schemas |
| `recharts` | 3.10.1 | The 7-day energy chart in Nutrition |
| `d3-shape` | 3.2.0 | Dashboard sparklines (with `d3-path` pinned via `overrides`) |
| `vega` / `vega-lite` | 6.4.x | **Dev only** — renders the local-LLM chart to a static SVG at build time, so `/ai` ships no chart code |

### Environment variables (server-side only)

| Variable | Effect |
| --- | --- |
| `MAIRA_API_KEY`, `MAIRA_PROJECT_KEY` | Primary cloud provider (Gigalogy MAIRA) |
| `MAIRA_CHAT_PROFILE_ID`, `MAIRA_SPEECH_PROFILE_ID`, `MAIRA_BILINGUAL_PROFILE_ID` | Per-task model routing |
| `MAIRA_GPT_PROFILE_ID` | Legacy override, applies to chat only |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Free Google AI Studio fallback — no card needed |
| `AI_GATEWAY_API_KEY`, `AI_GATEWAY_MODEL` | Vercel AI Gateway fallback |
| `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) | Private Supabase store |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob fallback store |
| `ASHA_MEMORY_STORE=1` | In-memory store, dev only |
| `ASHA_LLM_PROVIDER` | `maira` (default) / `ollama` / `maira-local` |
| `OLLAMA_BASE_URL`, `OLLAMA_CHAT_MODEL`, `OLLAMA_BILINGUAL_MODEL`, `OLLAMA_SPEECH_MODEL` | Local model mode |
| `ASHA_HYBRID_RETRIEVAL=0` | Keep all retrieval local |
| `ASHA_KNOWLEDGE_REGION` | Region the `asha-knowledge` edge function runs in |
| `ASHA_WORKFLOW_WEBHOOK_URL`, `ASHA_WORKFLOW_SECRET` (32+ chars) | n8n caregiver escalation |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web push |
| `CRON_SECRET` | Daily cleanup cron |
| `ASHA_DEV_ORIGINS`, `LOCAL_DEV=1` | Allow a tunnel host to reach the dev server |

**Secrets stay server-side.** None of these ever appear in HTML, client bundles, logs, or
URL query strings. This is stated in the project CLAUDE.md and is enforced by the fact
that `src/server/**` is only imported from `src/app/api/**/route.ts` and the MCP route.

---

## 4. Server architecture

### The handler contract

API logic lives in `src/server/handlers/*.js` as Node-style `(req, res)` handlers:
`asha.js`, `care.js`, `clinic.js`, `cleanup.js`, `health.js`, `session.js`, `workflow.js`.
They are framework-independent and directly unit-tested.

`src/server/node-adapter.ts` wraps them into App Router routes. The adapter:

- enforces the body bound (20,000 characters; Clinic keeps 660,000),
- returns 413 for oversized bodies and 400 for invalid JSON, both `no-store`,
- builds a `NodeLikeRequest`/`NodeLikeResponse` pair and awaits whichever finishes first.

Route files stay thin — six lines each:

```ts
import handler from "@/server/handlers/asha.js";
import { toRouteHandler } from "@/server/node-adapter";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const route = toRouteHandler(handler);
export { route as GET, route as POST, route as OPTIONS };
```

### Storage selection

`src/server/lib/common.js` picks the store **at import time**:

```
ASHA_MEMORY_STORE=1 (dev only)  →  memoryStore
SUPABASE_URL + secret key        →  supabaseStore
otherwise                        →  blobStore
```

The same module holds the origin allow-list (`mysunatislam.github.io`, the Vercel app
domain, `VERCEL_URL`, localhost in dev, plus `ASHA_DEV_ORIGINS` tunnel hosts),
the `no-store` header on every private response, and the `authenticate()` helper.

Authentication is capability-based, not accounts: a 24-hex patient id plus a bearer token
that hashes to either the patient hash or the caregiver hash of the stored profile.
The comparison is constant-time. An expired profile fails closed.

### Storage schema

`supabase/schema.sql` — one table, `public.asha_objects`, keyed by `path`, value as
`jsonb`. Row-level security is enabled, `anon` and `authenticated` are revoked, and
only `service_role` can read or write. The browser never touches this table. Namespaces
look like `asha-live/v1/<patientId>/events/…`, `asha-live/v1/<patientId>/profile`,
`asha-live/limits/<day>/guest-asha.json`.

### Cleanup cron

`vercel.json` declares `crons: [{ path: "/api/cleanup", schedule: "17 3 * * *" }]`.
Cleanup removes expired sessions, expired Everyday tenants, shared clinic records older
than 30 days, and the daily guest-limit counters.

### API surface

| Route | Purpose | Auth |
| --- | --- | --- |
| `GET/POST /api/session` | Create profile, update, heartbeat, patient event, caregiver ack, push subscribe, delete | Bearer token |
| `GET/POST /api/asha` | The assistant turn (chat, interpret, bilingual) | Patient bearer token, or guest with consent + rate limits |
| `GET/POST /api/care` | Care journal / health context, urgent and nonurgent paths | Mixed — urgent works without credentials |
| `GET/POST /api/clinic` | Clinic workspaces, invites, scopes, sharing, plans, revocation, audit | Role capability token |
| `GET/POST /api/workflow` | n8n status check and escalation callback | Signed HMAC, no browser `Origin` |
| `GET/POST /api/cleanup` | Retention cron | `CRON_SECRET` |
| `GET /api/health` | Configuration and store report | Public |
| `GET /api/mcp`, `GET/POST/DELETE /api/mcp/[server]` | Five MCP servers | Mostly public reference data; `asha-caregiver` needs a caregiver token |

---

## 5. The AI layer

### Provider selection and fallback

`src/server/lib/llm-provider.js` chooses by `ASHA_LLM_PROVIDER`:

- `maira` (default) — MAIRA cloud, with a Vercel AI Gateway backup, and a free Gemini
  key backup behind that.
- `ollama` — local models only; nothing leaves the computer.
- `maira-local` — cloud first, local model when the cloud is unreachable.

The fallback chain is explicit about *which* failures are retryable. Connection failures,
timeouts, provider-unavailable and rejected-credentials are retried; invalid requests,
cancellations and refusals are not. After MAIRA rejects its key, it is skipped for ten
minutes so each reply does not wait on a call known to fail.

### Task routing

| Task | Model route | Triggered by |
| --- | --- | --- |
| `conversation` | Gemini Flash | English chat |
| `bilingual` | Claude Opus | Bangla or mixed-language chat |
| `speech` | GPT | Unclear speech interpretation ("interpret" mode) |

This routing is a product choice, not a claim that any model is clinically best for a
language or speech impairment.

### The orchestrator

`src/server/lib/asha-orchestrator.js` is the part worth understanding. It is app code
around a *text* API — it does not claim undocumented native tool-calling.

1. Build the prompt from the guide text, the patient's confirmed speech corrections and
   the retrieved excerpts.
2. Ask the provider for a **structured** answer (JSON with `reply`, `tool_calls`,
   `source_ids`).
3. Verify the shape: cited source IDs must exist in the retrieved set; proposed actions
   must match the patient's explicit request.
4. If the model returned prose instead of JSON, recover a `reply` field if one is
   recoverable; otherwise the answer counts as unusable and the next route is tried.

Three tools are declared (`ASHA_TOOLS`): `retrieve_knowledge`,
`propose_caregiver_request`, `suggest_module`. **The only AI-proposed actions are an
optional module suggestion and a caregiver-request proposal — and a proposed request
still needs a separate, explicit patient confirmation before anything is sent.**

Negated, hypothetical and ambiguous needs do not propose requests. A first attempt gets
24 s, the whole turn 48 s; a failed or unusable answer moves to the alternate route once,
and if that also fails Asha answers from its own local guide so the patient always gets
a valid reply instead of an error.

### Retrieval

Two pipelines, with the local one always available:

| Path | What it is | When |
| --- | --- | --- |
| `src/server/lib/retrieval.js` | BM25 + Bangla/English query rewriting against the eight `okf/` guides | The fallback, always on |
| `src/server/lib/hybrid-retrieval.js` | Supabase pgvector + full-text + knowledge-graph expansion via the `asha-knowledge` edge function | Default when Supabase is configured |

The knowledge bundle is eight Markdown concepts with OKF v0.2-style frontmatter in
`okf/`. `okf/compile.mjs` checks each concept against the versioned application guide
and regenerates `okf/generated.js`, which Vercel imports at runtime. The compile fails
if the concepts drift from the guide.

The hybrid pipeline, in detail:

1. `scripts/build-knowledge-corpus.mjs` turns the guides into
   `supabase/functions/asha-knowledge/corpus.ts` (8 concepts, 52 sentences).
2. Sentences are embedded with `gte-small` (384 dims, mean-pooled, normalised). Chunk
   boundaries are similarity-based (that guide's 30th percentile), 120–480 characters,
   long guides embedded in windows of 6 sentences.
3. Each chunk is indexed with a contextual header ("ASHA app guide: Caregiver
   (caregiver module)") and one contextual sentence that places the chunk inside its
   guide.
4. Chunks above 0.97 cosine are deduplicated (none were found).
5. The graph holds 28 edges: 12 "mentions", 16 "similar" (guide centroids ≥ 0.8 cosine).
6. Index: Postgres + pgvector (HNSW, cosine) + a full-text GIN index in the `english`
   configuration, tables prefixed `asha_knowledge_`, RLS on, no anon access.
7. `rewriteQuery` maps Bangla and colloquial words onto the app's curated English
   lexicon (জেগে → wake, অনুরোধ → request).
8. Hybrid search fuses semantic and full-text rankings with reciprocal rank fusion
   (k = 50).
9. The app serves the top two hybrid passages plus the best passage from a graph
   neighbour of the top guide.
10. The edge function is called with a 2.5 s timeout and a 10-minute cache; any error,
    timeout or missing configuration falls back to the in-app BM25 ranking.

**Measured results** (`docs/RETRIEVAL.md`, 34 questions — 23 English, 11 Bangla):

| Method | All recall@3 | All MRR | English MRR | Bangla recall@3 |
| --- | --- | --- | --- | --- |
| In-app BM25 with lexicon (fallback) | 0.941 | 0.882 | 0.826 | 1.000 |
| Semantic only, rewritten | 1.000 | 0.980 | 1.000 | 1.000 |
| Hybrid RRF, rewritten | 1.000 | 0.966 | 0.978 | 1.000 |
| Hybrid + graph, rewritten (served) | 0.971 | 0.978 | 1.000 | 0.909 |
| Hybrid + graph, **no** rewriting | 0.794 | 0.755 | 1.000 | 0.364 |

Query rewriting is the load-bearing part: without it, the served ranking answers only 4
of 11 Bangla questions, because `gte-small` and the `english` full-text configuration do
not understand Bangla. The docs also state the honest caveat: the chunk contexts were
written by a writer who had seen the eval questions, so that gain is indicative, not a
measured improvement on unseen questions.

### Knowledge status

The bundle is eight short guides with provenance and draft status. The machine
verification means **source-text parity only, not human or clinical review**.

---

## 6. Module catalogue

The dashboard groups everything into five areas and thirteen modules
(`src/features/home/areas.ts` — one list, read by the home chooser, the side menu and the
area pages, so a module is defined once):

| Area | Modules |
| --- | --- |
| Communicate | Ask for help, FaceSpeak, EyeSpeak, FingerSpeak, SenseAssist, Practise your signals |
| Talk to Asha | Talk to Asha |
| Exercise | Move |
| Food | Nutrition |
| Wellbeing | Health outlook, VitalSense, Posture, Care journal |

### Communicate

**Ask for help** (`/dashboard/patient/communicate`) — five need kinds: water, food,
toilet, comfort, help. Each is a button in English and Bangla, plus a typed message and
gesture-triggered signals. The request goes through propose → confirm → send
(`src/features/requests/`); the patient sees Sent → Received → Acknowledged.

**FaceSpeak** — measured neutral baseline, then a practiced rapid triple blink and a
separate longer confirmation blink for eye-only communication, plus three observed
repetitions for selected smile/pucker/nod/head-turn skills. Only captured skills are
enabled. The visible blink count follows completed bilateral dips and recoveries in the
same raw EAR signal as the curve, using a recent open-eye reference rather than a stale
maximum. Tracking gaps, isolated spikes, winks and held closures are rejected. **Normal
blinks never send a request** — deliberate calibrated request recognition is separate.
Facial expression values are model signals, never a percentage of the patient's ability.

**EyeSpeak** — real iris/head regression with a personal ridge head fitted per user,
5/9/16-point capture, a separate held-out target check, dwell selection with rearm,
A–Z and Bangla phrases, undo/delete/suggestions/TTS, and touch/switch/focus fallback.
The eye cursor (a ring following the gaze on every patient page, slow blink to click)
only selects when buttons are too close for the user's measured accuracy, and then shows
big tiles instead. 478 iris points are required. Eye tracking is experimental and checks
its own accuracy before it can select anything.

**FingerSpeak** — the original full two-hand interface: real recorded samples, guided
calibration, temporal model training, prototype/DTW comparison, held-out evaluation,
probability curves and live intent/release gating. The model and samples are scoped to
the patient and survive navigation between pages. Familiar-pose three-hold mappings
remain an optional shortcut. Assessment never blocks this module.

**SenseAssist** — a user-started listening window of up to 90 seconds that reconnects
after browser silence cutoffs, pauses while Asha speaks, and stops when the page is
hidden or the module changes. Browser transcription/dictation, editable heard text,
server-powered AI interpretation with alternatives and explicit speaker confirmation,
spoken output, caregiver sending, AI practice guidance. Nearby voices can still be picked
up: this is not speaker identification or guaranteed echo cancellation.

**Practise your signals** — guided calibration for FaceSpeak and FingerSpeak, with
measured gesture calibration and skippable unsupported movements.

### Talk to Asha

Cloud chat (consent-gated) or the experimental on-device model: `@mlc-ai/web-llm`
running Qwen2.5 0.5B Instruct 4-bit on the browser GPU, downloaded once (~400 MB) and
cached by the browser. After that, messages never leave the device. Answers are simpler
than the cloud models and Bangla is weaker. It needs desktop Chrome or Edge.

`/api/asha` also serves guests: no care circle needed, same consent switch, no stored
profile, tighter limits (30 per 10-minute window per address, 1,500 ms minimum spacing,
a shared daily cap of 3,000 replies stored in the store so the cleanup removes it). A
guest's patient id is a one-way daily pseudonym of the address; the address itself is
never sent or kept.

### Exercise

**Move** — real MediaPipe Pose Landmarker Lite camera inference with four
exercise-specific complete-cycle counters, quality/occlusion/gap gates, One Euro
filtering, sets/time/history/trends/export. Version 4 adds a guided coach:
Learn → Set up → Practice (not counted) → Do → Rest, with original animated demos in
English and Bangla, a live landmark overlay aligned to crop/mirror/DPR, a show-all toggle,
and a raw-value panel. Version 2 adds a goal wizard, a versioned catalog, five body and
three face camera detectors, a sequential session engine with pause/reload/tracking-loss
handling, a rule-based English/Bangla safety stop and lockout, clinician clearance, and
consent-checked clinician plans.

The safety rules are fixed and rule-based, not model-based: the session stops on warning
signs and locks out. The camera measures a camera-plane angle — not force, pain, bone
health or clinical recovery. The clinician plan path is explicitly clinician-origin, but
this demo does not verify that professional's identity.

### Food

**Nutrition** — 11 attributed USDA ingredients with Bangla aliases, six editable recipe
templates, servings/grams/ranges/oil/salt, deterministic estimates, versioned corrections
and history, local image-quality checks.

**Nutrition V5** — live scan with steady-freeze (4 of 6 frames, once, with Retake /
Continue / shutter), photo upload with type/size/dimension checks, EXIF rotation and
metadata stripped, one still-image pipeline. Per-food adaptive questions with "I don't
know" / Skip / Back. A deterministic USDA-sourced calculator produces ranges, "at least"
and "estimate uncertain". Shared-pot oil and salt are handled. The eaten amount is
confirmed before logging. One write to a local log with canonical fields, in English and
Bangla.

Camera frames and uploaded photos are processed on the device in a worker and are never
uploaded or stored. An uploaded photo is redrawn onto a canvas (at most 1280 px), which
drops its location, camera and time metadata; that copy lives only in memory for the
current meal. Meal logs (answers, numbers, source ids, model id, capture method — no
photo) are kept in this browser's `localStorage` under `asha_live_nutrition_v5`, with
export, per-meal delete and delete-all.

The camera suggestion is **experimental**: a general ImageNet model (EfficientNet-Lite0
int8) that maps only banana, apple and strawberry. It is not food-trained, there is no
segmentation and no portion estimation. "Ask ASHA about this meal" only types a question
into Talk to Asha — nothing is sent until the person presses Send.

### Wellbeing

**Health outlook** (`/dashboard/patient/outlook`) — a rules-only risk engine
(`src/features/risk/engine.js`, rules version `risk-rules-2026-11-18`). Every alert lists
the readings that raised it, the threshold it crossed and where the threshold comes from.
Thresholds are sourced: NOAA/NWS heat index bands (27 / 32 / 41 °C), US EPA AQI (101 / 151),
WHO UV index (8), resting adult pulse (60–100 bpm) and breathing (12–20 /min), humidity
and intake floors. A camera reading on its own can raise at most a "watch"; an "act"
needs two independent sources that agree (for example heat and a raised pulse) or a
non-camera source such as unanswered requests. **Decision support, not diagnosis.**
Rules cover heat strain, air quality, pulse, breathing, facial stretch, missed requests,
hydration, move lockout and gap, low intake and UV.

**VitalSense** — restores the three-region POS/FFT pipeline from the original
`neurobridge-asha-unified-web/vitalsense`, not the separate PulseSight prototype. The full
view includes pulse and breathing estimates, signal quality, a 30-second resting-reference
calibration, waveform, session trend, provisional optical HRV and a CSV reading log.
Continuous 12-second pulse and 30-second breathing windows must actually be observed;
gaps, frozen frames, poor light and excess motion clear current readings. It renders an
actual heart silhouette paced to the current accepted estimate, not a detected individual
beat; weak, stale, hidden or paused observations disable the animation. **No fabricated
blood pressure, SpO₂ or temperature values.**

**Posture** — MediaPipe Pose Landmarker Lite in every patient view, with an optional
YOLO26n-pose ONNX cross-check in its own worker. Actual body landmarks, not a decorative
overlay. A rest-like-to-awake-like check-in requires continuous valid closed-eye and
still-body observations for 60 seconds, then open eyes and movement; occlusion or
tracking gaps reset the evidence. It does **not** measure sleep stages.

Sustained posture or asymmetric lip cues prompt the patient to confirm a caregiver
request. The original lateral-lip (3.5% of face width) and corner-asymmetry (4%)
thresholds use a same-side 60-second observation timer, with pose and symmetric-smile
guards and tracking-loss reset. Startup displacement is not learned away as neutral. **A
flag is not a seizure diagnosis and never places an automatic emergency call.**

**Care journal** (`/dashboard/patient/care`) — journal and self-reported health
context, explicit browser ASR consent, a 90-second listening window with output pause,
TTS, offline precautionary urgent templates, visit summaries and a consented server MAIRA
adapter. Urgent reports are handled by local templates before any model call; nonurgent
generation needs server credentials and an authenticated session, and falls back to local
educational guidance when the provider is unavailable. Clinical rules are unreviewed, and
there is no autonomous contacting or triage.

---

## 7. The caregiver side

`/dashboard/caregiver` — Overview, Requests (with a badge), Patients, Add patient,
Patient profile, Settings.

- Patient-scoped requests with separately hashed role tokens.
- Idempotent retries — an unsent request is kept on the device and retried
  (`src/features/requests/send.ts`).
- Received / acknowledged receipts; the patient sees the state change.
- Multiple assigned patients, with a patient switcher.
- Optional web push. Notification bodies contain no patient details.
- Foreground dashboard polling works without push.

Push is best-effort and OS-dependent; it is not an emergency dispatch service.

---

## 8. The Everyday workspace

`public/everyday.html` — nutrition, move, eyespeak, care and clinic in one workspace,
served as plain ES modules with its own light/dark theme and Bangla/English toggle.

### Evidence contract and consent

`public/app/everyday/contracts.js` defines the JSDoc evidence contract and validates it
at runtime. `EvidenceStore` owns local saving consent, encryption, retention and
deletion.

- Camera frames, photo pixels and microphone recordings are **not retained**.
- Records default to session memory. Reloading clears them unless the user creates an
  encrypted vault.
- AES-GCM-256 encrypts records and preferences. PBKDF2-SHA256 with a random 16-byte salt
  and 210,000 iterations derives a non-exportable key from a 10–1024-character passphrase.
  Each ciphertext uses a random 12-byte IV. Passphrases and keys are never stored.
- Lock cancels outstanding writes and removes in-memory plaintext. Atomic IndexedDB
  transactions and vault/policy identity guards prevent a stale tab from reviving deleted
  or revoked data.
- There is **no key recovery**. The vault does not protect against malicious code running
  in an unlocked same-origin page, a compromised browser, or a compromised device.
- Local retention is 7, 30 or 90 days, enforced on access/save/unlock. Module-saving
  revocation removes that module's local records.
- Exports are intentionally **unencrypted**, and are also shown as copyable text if OS
  downloads are blocked.
- Optional timing telemetry is local, off by default, bounded to 500 samples. No
  analytics upload was added. Language and theme alone use `localStorage`; cloud session
  and clinic credentials use tab `sessionStorage`.

### Shared inference

`CameraManager` owns a single stream and model and cancels late startup on navigation,
backgrounding or model failure. `ModelManager` validates weight bytes before the
MediaPipe runtime loads them and tries GPU, then CPU/WASM. WebGPU is detected as a
*device capability*, not claimed as a separately implemented runtime. One model runs at a
time; inference scheduling adapts downward when it takes longer. Camera permission denial
keeps touch, manual logging, journals and switch scanning usable.

### Clinic

`/api/clinic` uses random capability credentials, hashed at rest, tenant-prefixed keys,
server-enforced roles, per-patient sharing grants and audited actions. **This is a demo
access mechanism, not identity verification or a clinical account system.** Billing is a
future tenant-scoped concern; no payment integration exists.

Clinic scopes do not upload history by themselves. The patient must separately select
records and confirm sharing. Shared copies retain source/time/model/correction metadata.
Revocation hides them immediately, deletes server copies and invalidates the grant id;
renewed permission does not resurrect previous copies. Copies already viewed or exported
by another person cannot be remotely erased.

### Safety

`SAFETY_POLICY` in `public/app/everyday/safety.js` is the source of truth. Reported or
uncertain chest discomfort, breathing difficulty, loss of consciousness/faintness and
associated warning flags produce urgent templates **before any model call**. Structured
flags cannot be negated by narrative text. English, Bangla and transliteration, common
spelling errors, negation and contradictory reports are covered by tests — but coverage is
limited and recognition can fail for untested language. An educational question alone is
distinguished from a current symptom report. Overlong or empty text cannot proceed to AI.

Urgent guidance works without accounts, cloud availability or payment. It offers
region-aware contact instructions (Bangladesh 999; configurable GB/US/CA/EU/India; other
regions use the local emergency number) and a **user-operated** telephone link. The app
does not call anyone and does not send a caregiver or clinician message. It does not use
exercise, arm raising, diet history or a model to rule out a heart attack.

Nonurgent AI output is bounded educational text for visit preparation. It cannot invoke
tools or change measurements. Malformed output, a failed provider, claims of contacting
someone, common false reassurance and prohibited exercise/medication instructions fall
back to a local template. **These checks are defense in depth, not proof that all
model-generated medical text is safe.**

### Feature flags

`public/app/everyday/contracts.js` exports the explicit flags. They describe implemented
capability, **not clinical clearance or remote entitlement**.

| Flag | State |
| --- | --- |
| Nutrition / Move / EyeSpeak / Care / Clinic | On |
| Food vision | Off — no licensed, evaluated food classifier/segmentation weights |
| Offline ASR | Off — browser ASR is optional, no Whisper pack installed |
| Clinical release | Off — symptom protocol review pending |
| Signed release packs | Off — verification infrastructure is tested, but no trust key or signed release exists |

Clinical release cannot be enabled by a UI checkbox or an LLM response.

---

## 9. MCP servers

`src/server/mcp/servers.js` exposes five servers over Streamable HTTP
(stateless, JSON responses). `GET /api/mcp` returns an index with names, URLs, tool lists
and auth requirements.

| Server | Tools | Auth |
| --- | --- | --- |
| `asha-knowledge` | `search_app_guide`, `get_module_guide` | none (public reference data) |
| `asha-nutrition` | `search_foods`, `calculate_meal`, `recipe_template` | none |
| `asha-safety` | `check_symptom_safety`, `get_safety_policy` | none |
| `asha-caregiver` | `list_requests`, `acknowledge_request` | Bearer caregiver token — acts only with the caregiver's own token |
| `asha-models` | `list_models`, `route_task` | none |

Every tool returns its result both as JSON text and as `structuredContent`.

---

## 10. Caregiver escalation workflow (n8n)

`workflows/n8n/asha-caregiver-escalation.json` — a reminder when nobody acknowledges a
confirmed request.

1. **Webhook** `POST /webhook/asha-request` — called after the request is stored. The
   body holds only the request kind, request id, patient id and a time. **No request text
   or health details.**
2. **Verify signature** — the workflow recomputes an HMAC-SHA256 signature and stops if
   it does not match or the timestamp is more than five minutes old.
3. **Wait** `ASHA_ESCALATE_AFTER_SECONDS` (default 300).
4. **Status check** — `POST /api/workflow` with `action: "status"`.
5. **Still waiting?** — stops if the caregiver acknowledged.
6. **Escalate** — `action: "escalate"`, records the escalation and sends a push: "Asha ·
   request still waiting".

Safety rules in Asha:

- Both directions are signed over a dotted canonical string; the comparison is constant
  time.
- `/api/workflow` accepts only POST, refuses any request carrying a browser `Origin`
  header, and rejects unsigned or stale calls with 401.
- Asha re-reads the request and its receipt from its own store. The workflow cannot
  invent a request and cannot change what was asked.
- An acknowledged request is never escalated. Each request gets at most three reminders.
- The webhook call runs after the request is stored and the push is sent, with a 1.5 s
  timeout; a failure is reported as `workflow: "unavailable"` without failing the
  patient's request.

`npm run e2e:n8n` (with `N8N_BIN`) starts the real session and workflow handlers on an
in-memory store, imports and activates the workflow in a fresh n8n, and checks that only
the unacknowledged request is escalated and that a forged webhook causes no ASHA call.
The recorded run on 2026-11-18 with n8n 1.123.91 returned `{"ok": true, "unacknowledged":
{"count": 1}, "callbacks": ["status","status","escalate"], "forgedCallbacks": 0}`.

---

## 11. Data flow

### A confirmed request

```
Patient signal (blink / gesture / speech / touch)
  → module detects, produces a candidate
  → patient confirms (separate step, always)
  → POST /api/session { action: "event", kind, confirmed: true }
  → server stores the event under the patient namespace
  → caregiver polling picks it up / web push fires
  → caregiver acknowledges
  → receipt stored, patient's timeline advances to "Acknowledged"
  → if unacknowledged after 5 min, n8n escalates (at most 3 reminders)
```

### An assistant turn

```
Text (typed, spoken, or interpreted)
  → POST /api/asha { text, consent, patientId | guest, language, mode }
  → urgent? → local template, no model call
  → rate limit / daily cap check
  → retrieval: hybrid (pgvector + FTS + graph) → BM25 fallback
  → orchestrator → provider (MAIRA → AI Gateway → Gemini → Ollama)
  → verify: cited source ids exist, proposed actions match the explicit request
  → reply + (optional) module suggestion + (optional) request proposal
  → request proposal opens the patient's confirmation step; nothing is sent yet
```

### Clinic sharing

```
Patient selects records → confirms → POST /api/clinic (scoped, consented)
  → server stores a copy with source/time/model/correction metadata
  → clinician role token can read only the granted scope
  → patient revokes → copies hidden, server copies deleted, grant id invalidated
```

---

## 12. The website

There are **two** website surfaces, and the distinction matters.

### 12.1 The Next.js landing page (in this repository)

Route `/`, built in `src/app/page.tsx` from one component per section in
`src/components/landing/`, with **all copy in one file**, `src/content/landing.ts`.

Sections, in order:

| Section | Component | Anchor | Content source |
| --- | --- | --- | --- |
| Legacy entry | `LegacyEntry` | — | Redirects old `?module=` / `?role=` links into the assistive app |
| Navbar | `Navbar` | — | Sticky, blurred, mobile menu, scroll-spy underline, `Try Asha` |
| Hero | `Hero` | — | Badge, two-line title, lead, two CTAs, `HeroScene` |
| Journeys | `Journeys` | — | Recovery & rehabilitation / complex communication needs / ageing & bedside care |
| Story | `Story` | `#why` | "Silence shouldn't mean being alone" — the founding grandfather story, `MessageThread`, pull-quote |
| Modules | `Modules` | `#modules` | `ModuleRail` plus eight module cards with title + description + deep link |
| Care loop | `CareLoop` | `#care` | Adapt → Understand → Connect on one signal line, plus a link to the caregiver view |
| Hardware kit | `HardwareKit` | `#kit` | Camera + mount + switch, the $100 illustration, privacy note |
| Languages | `Languages` | — | Bangla + English greetings |
| Plans | `Plans` | `#plans` | Asha Plus $5/mo, Asha Pro $12/mo, Asha Kit $100 once |
| Principles | `Principles` | — | Ability first / Private by choice / People stay in control |
| Team | `Team` | `#team` | Three portraits with roles and public profiles |
| FAQ | `Faq` | — | Four honest answers |
| Contact | `Contact` | `#contact` | Email, phone, WhatsApp channels + the enquiry form |
| Closing | `Closing` | — | Restated CTA on the one saturated blue band |
| Footer | `Footer` | — | Product / Company / Connect link groups and the legal line |

**Design system.** Tokens are defined once in `src/app/globals.css` under Tailwind v4's
`@theme`. The base set — brand `#2563eb`, ink `#172b4d`, heading `#15345b`, muted `#64748b`,
line `#dbe5f0`, canvas `#ffffff`, wash `#f6f8fb`, danger `#a63c32`, `--shadow-card` and
`--shadow-float` — is shared with the dashboard, the auth pages and `/ai`, and is not
changed by the landing page. The landing page adds its own layer on top: `display`,
`brand-pale`, `brand-mid`, `mist`, `mist-line`, `line-strong`, `accent`, `accent-deep`,
`body` (landing body copy, 6:1 on the mist band, where `muted` is only 4.3:1),
`--shadow-panel` and `--shadow-lift`. Section surfaces run white → wash → pale → mist so
no two adjacent sections look alike.

**Themes.** Every React page has a light and a dark theme — the landing, the dashboard,
the auth pages and `/ai`. `src/features/theme/theme.js` holds the whole rule set as plain
JS, so `node --test` can import it the same way it imports
`src/features/enquiry/enquiry.js`: one stored preference — `light`, `dark` or `system` —
under the house storage key `asha_live_theme`, and one resolved theme that paints. The
root layout inlines `THEME_INIT_SCRIPT` as the first child of `<body>`, so the theme is set
on `<html>` before the first paint and the page never flashes the wrong one;
`ThemeProvider` then keeps it in step and follows the device while the preference is
`system`. The toggle sits in the landing navbar (and in the mobile sheet), in the app's
top bar, on the auth screens and on `/ai`; "use the device's theme" sits in the footer and
the mobile sheet.

The dark theme — "midnight signal" — re-declares the colour tokens on `:root`
(`html[data-theme="dark"]`), outside any cascade layer, so it beats the `:root` block
Tailwind emits from `@theme` and every page re-themes without touching a single component
class. Two rules keep the Tailwind utilities honest: in the dark theme `--color-white` is
the surface colour, so every `bg-white` card and field follows the theme instead of
punching a white hole in the page, while literal white lives in `--color-paper` for the
things that must stay white (a button on the saturated band, the wordmark on the auth
panel); and the callout colours are three semantic triples — `danger`, `warn` and `good`,
each a tinted surface, a line and a text — so a callout is one idea rather than three
unrelated palettes.

**Type.** Two self-hosted families, both under the SIL Open Font License 1.1. The Latin
body face is Inter (variable, latin) loaded through `next/font/local` — no build-time
network fetch. The Bangla face is Noto Sans Bengali, committed under `public/fonts/` as
three `unicode-range`-split `woff2` subsets, so a Latin page never downloads the 107 KB
Bangla file and Bangla text never falls back to whatever the operating system happens to
have installed. Provenance is recorded in `public/fonts/README.md`.

**The signal.** One recurring graphic object: a hairline that carries a message, with a
lit dot travelling along it (`src/components/landing/Signal.tsx` + the `.signal-track` and
`.signal-node` rules). It appears in the hero, the story thread, the care loop, the
journeys band and the closing band.

**Illustrations, not screenshots.** `HeroScene`, `MessageThread` and `ModuleRail` are
drawn in HTML — a patient space, a patient-to-caregiver exchange, and the app home. Each
is captioned as an illustration. When real demo footage exists, `hero.video.src` and
`modulesIntro.video.src` switch to a real `VideoFrame` instead.

Motion is progressive enhancement: the signal line draws itself and its lit dot travels
along it (`.signal-track`, `.signal-track--draw`), and `prefers-reduced-motion: reduce`
collapses all animation. Scroll-driven reveal was dropped in the redesign — content is
always visible — so the `Reveal` wrapper's `data-stagger` offset is currently inert.
Focus is a visible 2px brand outline with offset.

**Enquiry form.** `src/features/enquiry/EnquiryForm.tsx` + `enquiry.js`. It builds an
email or WhatsApp draft and **stores and sends nothing on this server** — it opens
`mailto:` or `wa.me` with the body pre-filled. Fields are bounded (name 100, email 160,
organisation 120, message 1,000 characters), the email must match a basic pattern, and
explicit contact consent is required. The body always ends with "Please reply to discuss
availability; this is not a confirmed booking." `buildEnquiryDraft` strips CR/LF and
trims, so a newline in the name cannot inject an extra mail header, and the interest
key is checked against an allow-list (unknown values fall back to `demo`). `tests/website-enquiry.test.mjs`
asserts all of this — including that the generated URL contains no whitespace and no
API-key-shaped text.

Interests: `demo` (Book a guided demo), `kit` (Optional Asha Kit enquiry), `hospital`
(Hospital / care-provider pilot), `homecare` (Home and family support). Plan cards and
the kit call-to-action preselect an interest through a small `asha:enquiry-interest`
custom event.

**Pricing is descriptive, not transactional.** Asha Plus $5/month, Asha Pro $12/month,
Asha Kit $100 one-time, all labelled "Proposed subscription · not yet sold online" with
the note "USD reference prices from the pitch deck — not a checkout or a payment
request." There is no payment integration, no checkout, and no booking receipt. The kit
excludes the phone/tablet and the subscription, and its $100 image is an *illustration*,
not a shipping-product photo or an installation specification.

**Team.** Mysunat Islam (CEO), Md Sifat Bin Jibon (COO), Hasibul Hasan Rahim (CTO) —
owner-confirmed portraits in `public/assets/team/*.webp` with the supplied public
GitHub/LinkedIn/Facebook profiles. No fabricated testimonials and no validation claims.

**Metadata and PWA.** `src/app/layout.tsx` sets the title, description, favicon and
apple-touch icon; `src/app/page.tsx` adds its own metadata and points the manifest at
`/app.webmanifest` (standalone display, start URL `./dashboard`, icon set 192/512 plus
maskable variants). `public/sw.js` caches only immutable model assets and the Everyday
shell; private API responses are never cached.

### 12.2 The separate public website deployment

`https://asha-neurobridge-website.vercel.app/` — a self-contained static site deployed
to **its own Vercel project**, with no API keys, no patient sessions and no sensing
engines.

Its source lived in a top-level `website/` folder in the repository history (added in
`60b6717`, extended in `2969b37`, and folded into the Next.js landing page in `a03127b`
"switched to next js from generic html"). The folder is no longer present in this
branch, but the deployment and the shared enquiry helper remain: `src/features/enquiry/enquiry.js`
is shared by both, and `public/assistive.html` still links "About Asha ↗" to the external
site. `next.config.mjs` redirects `/website` and `/website/index.html` there.

What that site contains, in its last in-repo version:

- Header with light/dark toggle, nav (Why Asha / Solutions / Kit & setup / Plans / Our
  team / Contact) and a "Try Asha" button pointing at the app domain.
- Hero, story, a five-tab **capability switcher** (FaceSpeak, FingerSpeak, SenseAssist,
  VitalSense, Posture) with keyboard arrow navigation, the care loop, hardware kit,
  plans, journeys, principles, a "From bedside to everyday life" journey section, the
  team, an FAQ and the contact form.
- `site.js` redirects any `?module=`/`?role=` query straight to the app domain, since
  the public site has no app inside it.
- Its own `vercel.json` sets `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  no-referrer` and a `Permissions-Policy` of `camera=(), microphone=(), geolocation=()`
  — the public site asks for no device permissions at all.

**What the website must never do**, and does not: no fabricated testimonials, no
validation or clinical claims, no patient-data collection, no payment checkout, no
fabricated booking receipt, no automatic emergency call. The enquiry form prepares a
draft; the team replies.

---

## 13. Safety, privacy and honest limits

### Consent gates

Camera, microphone, cloud chat, evidence saving and clinic sharing each require an
explicit user action. There is no path where a permission is acquired implicitly.

### What is never done

- No fabricated vitals.
- No automatic emergency calls.
- No diagnosis claims.
- No voice-cloning claims.
- Camera outputs are described as engineering observations.
- The safety rules in `public/app/everyday/safety.js` and `companion-safety.js` are not
  weakened; the urgent preflight runs *before* auth, storage reads and cloud consent
  checks.

### Data boundaries

| Data | Where it goes |
| --- | --- |
| Camera frames, photo pixels, microphone recordings | Not retained; local processing only |
| Food photos | The mounted view and an in-memory canvas copy, revoked on removal/navigation |
| Meal logs | This browser's `localStorage` (`asha_live_nutrition_v5`), no photo, never shared |
| Everyday records | Session memory, or an AES-GCM-256 IndexedDB vault |
| Health-outlook readings | Rules-only, local |
| Chat text | Only to the provider, and only after cloud consent |
| Confirmed speech pairs | Ranked on the ASHA server with local BM25; never sent to the vector index |
| Retrieval queries | The `asha-knowledge` edge function receives the message text and its rewritten keywords to embed and search the public guides; it does not log or store it, and the response contains only public guide passages |
| Vector tables | Public OKF guides only, never patient data |
| Local LLM mode | Prompts go only to the Ollama server named by `OLLAMA_BASE_URL` |
| Patient identity in the app | Pseudonymised: capability tokens and hashed role tokens, never a name |
| Push notification bodies | No patient details |

The Clinic role link is a **credential** — keep it private. The server stores only token
hashes. Demo workspaces and roles expire after 30 days.

### What is explicitly *not* proven

- Camera-model tests use official MediaPipe fixtures, not patient validation.
- Mobile performance and real gesture accuracy depend on device, lighting and
  positioning; calibrate on the actual patient's phone.
- The shipped microphone transcript comes from browser speech recognition (or keyboard
  dictation), **not a falsely labelled provider audio transcription service** — the
  provider's dedicated `/v1/voice-typing/session` returned 401 in the integration check.
  No clinical dysarthric-speech accuracy or speaker-identification claim is made.
- Browser camera monitoring works only while the patient page is open and active. A
  locked or backgrounded phone may stop the camera.
- The retrieval numbers are a check that the pipeline works, not a benchmark: the
  questions were written by the team, not by patients, and the set is small.
- The `d3-shape` and `vega` versions are pinned to exact 2022 releases because newer
  patch releases had appeared and had not been reviewed.

### Outstanding release gates

Clinician-authored symptom scenarios and clinical approval; licensed and evaluated
Bangladesh food weights and segmentation; weighed-meal validation; independent
motion/gaze reference studies; low-end mobile measurements; accessibility and
intended-user usability testing; provider privacy/security/regulatory assessment;
production role identity and staffed-workflow decisions; jurisdiction-specific
regulatory assessment; a release signing trust root for signed model packs.

---

## 14. Testing and CI

`.github/workflows/ci.yml` runs on every push to `main` and every pull request:

```bash
npm ci
npm test                    # 392 tests, all passing as of this pass
npx tsc --noEmit -p .
node scripts/local-llm-chart.mjs --check
```

No secrets and no network are needed: the store, the model providers and the retrieval
index are faked or run in memory.

Test suites by kind:

| Kind | Files | What it covers |
| --- | --- | --- |
| Unit (`node:test`) | 51 | Blink observation and intent, facial baseline, head returns, hand profiles, caregiver rules, RAG and tool verification, speech echo blocking, store consistency, VitalSense signal windows, Move detectors and safety, nutrition V5, OKF compile parity, MCP servers, next-api integration, workflow escalation, the website enquiry |
| Browser (Playwright) | 25 | Real camera and model init, shared-camera regression, two-hand calibration, responsive layouts, no JS exceptions, request → receipt → acknowledgment across two contexts, the EveryDay vault (create/reload/wrong password/unlock/lock/export/delete/ciphertext inspection), permission denial, offline shell |
| Offline | 1 | Service-worker install, offline reload, local chest-symptom guidance, independent Nutrition navigation with no server |
| Evaluation | scripts | Retrieval eval, local-LLM eval and chart, move tracking benchmark, everyday benchmark, nutrition vision check, public-data validation |

The browser suites hard-assert a loopback base URL and never touch production. Camera
denial tests and synthetic-feed benchmarks do **not** validate human pose or gaze
accuracy.

---

## 15. Design and engineering conventions

- **TypeScript** in `src/**`; the retained browser apps stay plain ES modules.
- **Reusable components**: `src/components/ui` is the shared design system, and
  `src/content/landing.ts` holds all landing copy and data.
- **Reuse before adding**: the same three frontends share one camera, one store
  abstraction and one provider abstraction. Every new dependency needs a reason.
- **Simple over clever**: the orchestrator, the store picker and the handler contract
  are all plain and readable.
- **One list per concept**: `src/features/home/areas.ts` defines modules once;
  `src/features/dashboard/nav.ts` derives the sidebar from it.
- **Secrets never leave the server** (§3).
- **`next dev` rewrites `AGENTS.md`** with the Next.js version-caveat block — that file is
  regenerated by the tool and belongs in the diff.
- **This Next.js version has breaking changes versus older training data.** Read
  `node_modules/next/dist/docs/` before writing Next-specific code.

---

## 16. Open items

1. **Next.js security advisory.** `npm run build` prints
   `SecurityFatalError: Your version of Next.js is affected by a known security
   vulnerability` for the pinned `next@^16.4.3`, and asks that the upgrade be run
   (`next upgrade --agent=security --internal-nudge-id=783cab07-0f45-448a-87e8-eb0acef15ec7`).
   The build completes on retry, but the pinned version should be reviewed and upgraded
   before a release.
2. **The Next.js merge is still local.** The approved, production-verified release is the
   static Everyday release `6f11e60`. The React dashboard, the retained assistive app and
   the Everyday workspace now coexist, and their build passes, but final
   compatibility/browser/offline verification against a preview deployment is tracked
   separately (`docs/VALIDATION_PLAN.md`).
3. **The external website's source folder is not in this branch.** The deployment
   (`asha-neurobridge-website.vercel.app`) still runs from the last static build, and
   `src/features/enquiry/enquiry.js` is the shared piece. If the site needs to change,
   confirm where its source of truth lives before editing.
4. **Documentation drift.** The README mixes shipped behaviour with historical narrative;
   `docs/` is the more precise source, and this document reflects the code as of
   `7a14d54`.
