# Development and release

Implementation branch: `codex/asha-everyday-companion`, isolated worktree `E:\asha-everyday-implementation`. The approved static Everyday release `6f11e60` is deployed and production-verified. The branch is now integrating `origin/nextjs-migration`; that Next.js merge has passed its production build and remains local pending final compatibility verification. Existing uncommitted marketing-website changes in the original checkout are outside this branch and were left untouched.

```powershell
cd E:\asha-everyday-implementation
npm ci --cache .npm-cache --ignore-scripts --no-audit --no-fund
$env:LOCAL_DEV = "1"
$env:ASHA_MEMORY_STORE = "1"
npm run dev -- --hostname 127.0.0.1 --port 4180
# Open http://127.0.0.1:4180/everyday.html
# Run checks in another terminal while the dev server is running:
npm test
npm run test:everyday
npm run benchmark:everyday
# Stop the dev server before checking the production build:
npm run build
# With the existing server credentials configured:
npm run start -- --hostname 127.0.0.1 --port 4180
```

The application now requires a Next.js build. `npm run dev` starts the development server; `npm run build` creates the production output; `npm run start` serves that output. The default Next port is 3000; the commands above use 4180 to match the existing browser QA defaults. Browser QA currently follows the repository's Windows-installed Chrome/Playwright runtime paths. Adjust those test-tool paths for another development machine; they are not client dependencies.

Next serves the React chooser at `/`, the React workspace at `/dashboard`, the retained assistive app at `/assistive.html`, and Everyday at `/everyday.html`. Browser assets live under `public/app/everyday`, `public/engine`, `public/neuroface` and `public/models`; `public` is omitted from their URLs. Compatibility redirects preserve existing assistive entry routes. `scripts/dev.mjs` is no longer the development server.

Every `/api/*` endpoint runs locally through `src/app/api/*/route.ts` and `src/server/handlers`. There is no development proxy to production. With the development-only `ASHA_MEMORY_STORE=1` setting, all private API storage is in memory and restart clears it. The flag is ignored when `NODE_ENV=production`, so a built production server requires its normal private store configuration. Different localhost browser contexts can exercise scopes, roles and plans. Tests block unintended production API calls and remove their local clinic workspace. Care urgent templates need no keys; nonurgent cloud Care requires existing MAIRA credentials and an authenticated local session, with a labelled fallback when unavailable.

Production API handlers reuse the established private Supabase/Blob store and server-only MAIRA provider. No DB schema migration or new secret is required. Existing environment configuration remains necessary: `SUPABASE_URL` and the configured secret-key variable (or the existing Blob token), `MAIRA_API_KEY`, `MAIRA_PROJECT_KEY`, optional configured task profile IDs, and existing `CRON_SECRET`. Do not place values in HTML, commits, logs or URL query strings. Preserve existing push/VAPID configuration for the assistive app. This branch does not manufacture a provider profile/model or bypass missing credentials.

`vercel.json` now declares the Next.js framework, Node route-function duration and the existing `/api/cleanup` cron. API wrappers live in `src/app/api`; implementation and store code live in `src/server/{handlers,lib}`. All API responses use `no-store`. The standard body limit is 20,000 characters; Clinic retains its 660,000-character selected-record sharing limit. Daily cleanup still invokes Everyday tenant/record retention. Private Blob JSON reads retain `useCache: false` for current permissions, consent and request receipts.

Production verification of `6f11e60` covered Supabase-backed Clinic sharing, a self-attested clinician plan, revocation, unauthenticated local urgent responses from Asha/Care, a real MAIRA Care response, and patient request → caregiver acknowledgement → patient receipt. Anonymous fixtures were deleted. That approved release did not change the database schema or provider profile configuration. These results establish the preceding production release; they do not establish deployment or compatibility of the pending Next.js merge.

The first Next integration build completed compilation and TypeScript checks, then the managed filesystem sandbox reported `EPERM` during prerendering. The subsequent build outside that sandbox restriction completed successfully. Final compatibility/browser/offline verification is still tracked separately in the integration report.

Before releasing the Next.js merge: review the branch/diff; finish the build and full automated/browser/offline checks; validate a preview with the existing server configuration; verify old private links and `/assistive.html` alongside `/dashboard` and `/everyday.html`; check installed service-worker updates. Repeat clinic sharing and caregiver request/receipt on two real phones, and review provider privacy/access costs and public workspace creation abuse limits. The workspace role links are demo capabilities, not verified clinician identities or a staffed clinical service.

For a Next.js release rollback, restore the last verified deployment (`6f11e60`) as one unit, including its routing and service worker; mixing static and Next asset paths is not a supported rollback. The retained assistive app remains available at `/assistive.html` within the merged code. Model pack cryptographic rollback is implemented/tested separately, but release packs remain disabled until a real public trust key and signed artifacts exist. Cache eviction removes local vision downloads without touching health records.

## Optional AI services (added after the Next.js merge)

These are additive. Each one is off or falls back safely when its settings are missing.

| Setting                                                                                 | Effect when set                                                                                            | Without it                                                       |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `SUPABASE_URL` + secret key (already configured)                                        | Hybrid retrieval through the `asha-knowledge` edge function ([RETRIEVAL.md](RETRIEVAL.md))                 | In-app BM25 retrieval                                            |
| `ASHA_HYBRID_RETRIEVAL=0`                                                               | Keeps all retrieval local                                                                                  | (default is on when Supabase is configured)                      |
| `ASHA_KNOWLEDGE_REGION`                                                                 | Region the `asha-knowledge` function runs in; empty lets Supabase pick the one nearest the caller          | `ap-northeast-1`, where the database is                          |
| `ASHA_LLM_PROVIDER`                                                                     | `maira` (default), `ollama`, or `maira-local` (MAIRA, then a local Ollama model when MAIRA is unreachable) | MAIRA only                                                       |
| `OLLAMA_BASE_URL`, `OLLAMA_CHAT_MODEL`, `OLLAMA_BILINGUAL_MODEL`, `OLLAMA_SPEECH_MODEL` | Where the local models run and which ones to use                                                           | `http://127.0.0.1:11434` and the defaults in `MODEL_REGISTRY.md` |
| `ASHA_WORKFLOW_WEBHOOK_URL` + `ASHA_WORKFLOW_SECRET` (32+ characters)                   | Confirmed requests notify the n8n caregiver escalation workflow ([WORKFLOWS.md](WORKFLOWS.md))             | No workflow calls; `/api/workflow` rejects every callback        |

The hybrid retrieval release added three `asha_knowledge_*` tables, the `vector` and `pg_net` extensions, one Vault secret (`asha_index_token`) and the `asha-knowledge` edge function to the Supabase project (migration `supabase/migrations/20261118120000_asha_knowledge_rag.sql`). Two later migrations only add to ASHA's own objects: `asha_hybrid_graph_search` (search and graph expansion in one call) and the chunk `context` and `fts_context` columns for contextual retrieval. Existing tables were not changed. The edge function holds only the public app guides.
