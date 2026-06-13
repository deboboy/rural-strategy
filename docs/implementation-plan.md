# Washington Rural Strategy — Implementation Plan

**Status:** Draft  
**Date:** 2026-06-13  
**Authors:** Frank Martinez, Leo (research collaborator)

This document captures product decisions, architecture, and a phased implementation plan for adding authentication, an agentic AI assistant, and collaborative notes to the rural-strategy web app.

---

## 1. Summary

The app will evolve from a **static Vercel site** into a **static front end + serverless API** deployment with:

| Capability | Approach |
|------------|----------|
| **Auth** | Env-based username/password for two users; Vercel Middleware + signed session cookie (7-day TTL); whole site gated |
| **AI assistant** | OpenRouter API with tool calling (not RAG) + optional [Fusion](https://openrouter.ai/docs/guides/features/server-tools/fusion) server tool for multi-model deliberation |
| **Notes** | Vercel Postgres; page-anchored Markdown notes with comments; visible to all authenticated users |
| **Sensitive data** | `docs/` and agent tool data remain **server-side only**; never shipped in the public static bundle |

---

## 2. Decisions (Q&A)

### 2.1 Authentication

| Question | Decision |
|----------|----------|
| Usernames | **Frank** and **Leo** |
| Session length | **7 days** |
| Scope | **Entire site** protected (home, map, about, PNG, API, notes, chat) |
| Mechanism | Lightweight env-variable credentials; no OAuth or heavy auth framework |

**Environment variables (planned):**

```bash
# Session signing
SESSION_SECRET=...                    # random 32+ byte secret

# User 1 — Frank
AUTH_USER_FRANK=Frank                   # login username (display + auth)
AUTH_PASS_FRANK=...                      # password

# User 2 — Leo
AUTH_USER_LEO=Leo
AUTH_PASS_LEO=...

# Optional display names (defaults to username)
AUTH_DISPLAY_FRANK=Frank
AUTH_DISPLAY_LEO=Leo
```

**Flow:**

1. Unauthenticated requests → redirect to `/login.html`
2. `POST /api/auth/login` validates username/password against env pairs
3. On success → set **httpOnly**, **Secure**, **SameSite=Lax** cookie with signed JWT (`sub`, `displayName`, `exp`)
4. Vercel Middleware verifies cookie on every request except `/login`, `/api/auth/login`, and static assets required for the login page
5. `POST /api/auth/logout` clears cookie

---

### 2.2 AI agent

| Question | Decision |
|----------|----------|
| Provider | **OpenRouter** (API key provided by Frank) |
| Fusion | **Yes** — test [OpenRouter Fusion server tool](https://openrouter.ai/docs/guides/features/server-tools/fusion) for multi-model deliberation on complex strategy questions |
| Pattern | **Agentic tool use**, not RAG — model invokes tools to fetch structured data on demand and reasons over results |
| Data scope | **Everything** — clinics GeoJSON, network GeoJSON/CSV, research briefs, summaries |
| Map context | **Yes** — pass current viewport (bounds, zoom) and last tapped/selected clinic to the agent when chatting from the map page |
| Chat history | **Persist per user** in Vercel Postgres |

**Environment variables (planned):**

```bash
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=...                     # e.g. anthropic/claude-sonnet-4, openai/gpt-4.1
OPENROUTER_FUSION_ENABLED=true           # toggle Fusion tool in agent loop
OPENROUTER_FUSION_ANALYSIS_MODELS=...    # optional JSON array override for Fusion panel
```

**Agent tools (server-side, not RAG):**

| Tool | Purpose |
|------|---------|
| `listClinics` | Paginated/filtered clinic list from embedded + docs sources |
| `getClinicById` | Single clinic record |
| `clinicsByCounty` | Aggregate clinics for a county |
| `clinicsInBounds` | Clinics within lat/lng bounding box (supports viewport context) |
| `getNetworkSummary` | Summary stats from `wa-rural-clinic-network-summary.csv` |
| `getNetworkNodes` | Network nodes/edges from `wa-rural-clinic-networks.csv` / geojson |
| `getResearchBrief` | Sections from `rural-wa-farmworker-social-graph-research-brief.md` |
| `getSocialGraphSummary` | Content from `social-graph-research-summary.md` |
| `searchDocs` | Keyword search across server-side markdown/CSV (structured grep, not vector RAG) |

**Fusion integration:**

Per [OpenRouter Fusion docs](https://openrouter.ai/docs/guides/features/server-tools/fusion), Fusion is invoked as a server tool (`openrouter:fusion`) when the outer model decides a prompt benefits from multiple perspectives. For rural healthcare strategy questions (tradeoffs, regional comparison, ethical outreach design), Fusion is a good fit.

Planned behavior:

- **Default:** Outer model + project data tools; Fusion available but not forced
- **Optional “Deep analysis” toggle in UI:** sets `tool_choice: required` or explicitly requests Fusion for deliberation-heavy prompts
- **Fallback:** If Fusion fails or degrades (panel/judge errors), agent answers from tool data alone

**Map page context payload (client → API):**

```json
{
  "page": "/rural-health-clinics-wa-map.html",
  "viewport": {
    "center": [-120.74, 47.75],
    "zoom": 6.5,
    "bounds": [[west, south], [east, north]]
  },
  "selectedClinic": {
    "facility": "...",
    "county": "...",
    "coordinates": [-119.98, 46.31],
    "properties": { }
  }
}
```

**Chat persistence schema (sketch):**

- `conversations` — `id`, `user_id`, `title`, `page_path`, `created_at`, `updated_at`
- `messages` — `id`, `conversation_id`, `role` (`user` | `assistant` | `tool`), `content`, `metadata` (JSON: tool calls, map context snapshot), `created_at`

---

### 2.3 Notes & comments

| Question | Decision |
|----------|----------|
| Scope | **Page-anchored** — notes tied to URL path (e.g. `/`, `/about.html`, `/rural-health-clinics-wa-map.html`) |
| Visibility | **All authenticated users** see all notes on a page |
| Format | **Markdown** preferred; render with a lightweight client-side parser (e.g. marked + DOMPurify) |
| Updates | **Refresh to see collaborator edits** (no WebSockets in v1) |

**UX (sitewide):**

- Floating **Notes** panel on every page (alongside future **Ask** / chat panel)
- List notes for `window.location.pathname`
- Create note (Markdown textarea)
- Thread comments under each note
- Author attribution: **Frank** or **Leo** from session

**Schema (sketch):**

- `notes` — `id`, `page_path`, `author`, `body` (Markdown), `created_at`, `updated_at`
- `comments` — `id`, `note_id`, `author`, `body` (Markdown), `created_at`

---

### 2.4 Infrastructure

| Question | Decision |
|----------|----------|
| Database | **Vercel Postgres** (Neon) — notes, comments, chat history |
| Sensitive docs | **`docs/` stays server-side** — read only via API/agent tools; not copied to `dist/` |
| Deployment | Keep static HTML build for pages; add `/api/*` serverless functions + `middleware.js` |

---

## 3. Target architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Frank / Leo)                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Static pages │  │ Notes panel  │  │ Agent chat panel │  │
│  │ index, map,  │  │ (page-scoped)│  │ (+ map context)  │  │
│  │ about, login │  │              │  │                  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
└─────────┼─────────────────┼───────────────────┼────────────┘
          │                 │                   │
          ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Vercel Middleware — session cookie check → redirect /login │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  Serverless API (`/api/*`)                                  │
│  • auth/login, auth/logout, auth/me                         │
│  • notes, comments (CRUD)                                   │
│  • chat (stream) — OpenRouter + tools + optional Fusion     │
│  • agent tools read docs/, clinic geojson, network data     │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────┐    ┌─────────────────────────────────┐
│  Vercel Postgres     │    │  Server-side data (not in dist) │
│  notes, comments,    │    │  docs/*.md, *.csv, *.geojson    │
│  conversations, msgs │    │  clinic geojson (source file)   │
└──────────────────────┘    └─────────────────────────────────┘
```

---

## 4. Repository changes (planned)

### 4.1 New directories / files

```
rural-strategy/
├── middleware.js                 # Auth gate
├── api/
│   ├── auth/
│   │   ├── login.js
│   │   ├── logout.js
│   │   └── me.js
│   ├── notes/
│   │   ├── index.js              # GET list, POST create (by page_path)
│   │   └── [id]/
│   │       ├── index.js          # PATCH, DELETE
│   │       └── comments.js
│   └── chat/
│       ├── index.js              # POST stream, GET conversations
│       └── [id].js               # GET messages for conversation
├── lib/
│   ├── auth.js                   # JWT sign/verify, user lookup
│   ├── db.js                     # Postgres client (@vercel/postgres)
│   ├── agent/
│   │   ├── tools.js              # Tool definitions + executors
│   │   ├── openrouter.js         # OpenRouter client + Fusion config
│   │   └── system-prompt.js
│   └── data/                     # Server-side readers for docs + clinics
├── db/
│   └── schema.sql                # Migrations / initial schema
├── login.html
├── scripts/
│   └── prepare-deploy.mjs        # Updated: exclude docs/ from dist
├── public/ or dist/              # Static pages + shared JS for panels
│   ├── js/
│   │   ├── notes-panel.js
│   │   ├── chat-panel.js
│   │   └── auth-check.js
│   └── styles/
│       └── panels.css
└── docs/
    └── implementation-plan.md    # This document
```

### 4.2 Build / deploy

- **`prepare-deploy.mjs`:** Continue building static pages into `dist/`; add shared panel JS/CSS; **do not** copy `docs/` to output
- **`vercel.json`:** Add `middleware` reference; ensure `/api/*` routes are not swallowed by static rewrite
- **Map page:** On clinic tap and `moveend`, update in-memory context object consumed by chat panel

### 4.3 Static page updates

Each authenticated page gets:

- Shared header nav: Home | Map | About | Notes | Ask | Logout
- Notes panel (slide-over or bottom sheet on mobile)
- Chat panel (slide-over; preloads page + map context)
- Session user label (“Frank” / “Leo”)

---

## 5. Security considerations

1. **Passwords** — stored as env vars in Vercel only; never committed
2. **Session cookie** — httpOnly, Secure, SameSite=Lax; signed with `SESSION_SECRET`
3. **API routes** — all require valid session except login
4. **Data exfiltration** — agent tools return only what the model requests; no bulk dump endpoint
5. **Markdown XSS** — sanitize rendered HTML (DOMPurify)
6. **Rate limiting** — basic rate limit on `/api/auth/login` and `/api/chat` (Vercel KV counter or in-memory per-instance fallback)
7. **OpenRouter key** — server-side only
8. **Mapbox token** — continue build-time injection; remains env-only

---

## 6. Phased implementation

### Phase 1 — Auth foundation (estimate: 1–2 days)

- [x] Add `middleware.js` + `login.html`
- [x] Implement `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- [x] Set Vercel env vars for Frank and Leo
- [x] Verify whole-site gate on production

### Phase 2 — Database + notes (estimate: 1–2 days)

- [x] Provision Vercel Postgres; run `schema.sql`
- [x] CRUD API for notes and comments
- [x] Sitewide notes panel UI (Markdown write, HTML render)
- [x] Mobile-friendly panel layout

### Phase 3 — Agent + tools (estimate: 2–3 days)

- [x] Server-side data loaders for clinics + `docs/`
- [x] Tool executors + system prompt
- [x] `/api/chat` streaming via OpenRouter
- [x] Chat panel UI; conversation list + persistence
- [x] Map context wiring (viewport + selected clinic)

### Phase 4 — Fusion + polish (estimate: 1 day)

- [ ] Integrate `openrouter:fusion` server tool per [Fusion docs](https://openrouter.ai/docs/guides/features/server-tools/fusion)
- [ ] “Deep analysis” UI toggle
- [ ] Error handling for Fusion degradation
- [ ] End-to-end test with Frank + Leo accounts

---

## 7. Environment variables checklist (Vercel)

| Variable | Required | Notes |
|----------|----------|-------|
| `SESSION_SECRET` | Yes | Random secret for JWT |
| `AUTH_USER_FRANK` | Yes | `Frank` |
| `AUTH_PASS_FRANK` | Yes | Strong password |
| `AUTH_USER_LEO` | Yes | `Leo` |
| `AUTH_PASS_LEO` | Yes | Strong password |
| `POSTGRES_URL` | Yes | Auto-set by Vercel Postgres integration |
| `OPENROUTER_API_KEY` | Yes | From OpenRouter dashboard |
| `OPENROUTER_MODEL` | Yes | Primary outer model |
| `OPENROUTER_FUSION_ENABLED` | No | Default `true` for testing |
| `MAPBOX_ACCESS_TOKEN` | Yes | Existing; build-time map injection |

---

## 8. Open questions (minor — can decide during build)

1. **Conversation UX:** One continuous thread per page, or multiple conversations per page per user?
2. **Fusion default:** Always attach Fusion tool vs. only when user enables “Deep analysis”?
3. **Note editing:** Allow edit/delete own notes only, or either user can edit any note?
4. **Login page branding:** Minimal form vs. match site header/style (recommend match)?

---

## 9. Out of scope (v1)

- Real-time note/chat sync (WebSockets / SSE push)
- Vector RAG / embeddings
- More than two users
- Public or shareable unauthenticated links
- Cursor SDK / repo-level agents (different product from in-app OpenRouter assistant)
- Email notifications on new comments

---

## 10. References

- [OpenRouter Fusion server tool](https://openrouter.ai/docs/guides/features/server-tools/fusion)
- [Vercel Middleware](https://vercel.com/docs/functions/edge-middleware)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Vercel AI SDK](https://sdk.vercel.ai/docs) — optional wrapper around OpenRouter streaming (compatible via OpenAI-compatible endpoint)

---

*Next step: approve this plan, then implement Phase 1 (auth).*
