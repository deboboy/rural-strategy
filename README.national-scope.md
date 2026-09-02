# Rural Healthcare Transformation — National Scope

National research testing whether the Mi Salud rural care-coordination model
(closed-loop CHW → nurse → provider referrals, multimodal native-language
intake, BYOD remote monitoring) is applicable across the USA.

**Live:** https://rural-strategy.vercel.app (branch `national-scope`)

> This branch replaces the original WA-only rural strategy static site.
> The original site lives on `main` and is untouched.

## Layout

| Path | Purpose |
|---|---|
| `web/` | Next.js 15 findings dashboard (static, free-tier friendly) |
| `web/data/findings.json` | Generated findings consumed by the app — do not hand-edit |
| `research/` | Source research markdown (claim1/2/3 + all-sources) |
| `scripts/research_sync.py` | Parses research markdown → `web/data/findings.json` |
| `.github/workflows/research-sync.yml` | Weekly refresh (Mondays 14:00 UTC): re-syncs findings, commits, Vercel auto-deploys |

## The three claims

1. **Closed-loop referrals** — CHW → nurse → provider → back to CHW, tracked to completion
2. **Multimodal intake** — voice / SMS / text / handwritten, in the patient's language
3. **BYOD remote monitoring** — patients' own devices + home kits, store-and-forward gateway

Each claim gets four national-scope questions: evidence, existing practice,
policy feasibility, and the gap the model fills. Verdicts: SUPPORTED /
PARTIALLY / NOT, with per-claim confidence and cited sources.

## Refreshing findings

Local:

```bash
# edit research/*.md (or re-run research elsewhere), then:
python3 scripts/research_sync.py
cd web && npm run build
```

Automatic: the `research-sync` workflow runs weekly, regenerates
`findings.json`, and pushes — Vercel picks up the deploy. The sync script
falls back to reading `research/*.md` from this branch via GitHub raw URLs,
so research updates committed anywhere reachable still flow through.
