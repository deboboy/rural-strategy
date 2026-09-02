#!/usr/bin/env python3
"""research_sync.py — parse research markdown into findings.json for the dashboard.

Reads claim files from /root/evalbox-terminal-hermes/research/2026-09-02_national-scope/
(front matter: claim, verdict, confidence; body: rationale sections; sources list)
and emits web/data/findings.json consumed by the Next.js app.

Also supports remote mode: pass a GitHub raw URL base to fetch claim files
(cron runs on other machines can pull the latest research without the repo).
"""
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

LOCAL_DIR = Path("/root/evalbox-terminal-hermes/research/2026-09-02_national-scope")
OUT = Path(__file__).resolve().parent.parent / "web" / "data" / "findings.json"

CLAIM_FILES = [
    (1, "closed-loop-referrals", "claim1-closed-loop-referrals.md"),
    (2, "multimodal-intake", "claim2-multimodal-intake.md"),
    (3, "byod-rpm", "claim3-byod-rpm.md"),
]

RAW_BASE = ("https://raw.githubusercontent.com/deboboy/rural-strategy/"
            "national-scope/research/")


def _scalar(block: str, key: str):
    """Extract a scalar or folded (>) value from front matter, handling multiline."""
    # folded/quoted multiline: key: > ... indented lines ... until next key or end
    m = re.search(
        rf'^{key}:\s*[>\-]?\s*\n?((?:"[^"]*"|(?:(?!^\w+:).)+))',
        block,
        re.M | re.S,
    )
    if not m:
        return None
    val = m.group(1)
    # collapse folded multiline
    val = re.sub(r"\s*\n\s*", " ", val).strip().strip('"')
    return val or None


def parse_claim_md(text: str) -> dict:
    """Parse front matter + sections + sources from a claim markdown file."""
    # Front matter
    fm = {}
    fm_match = re.match(r"^---\s*\n(.*?)\n---", text, re.S)
    if fm_match:
        block = fm_match.group(1)
        for key in ("claim", "verdict", "confidence"):
            v = _scalar(block, key)
            if v:
                fm[key] = v

    # Sources block (list of - title: ... url: ... note: ...)
    sources = []
    # find 'sources:' key whose entries end where a non-list line begins
    src_match = re.search(r"^sources:\s*\n((?:[ \t]+-.*\n(?:[ \t]{4,}.*\n)*)+)", text, re.M)
    if src_match:
        block = src_match.group(1)
        for entry in re.split(r"\n(?=[ \t]+-\s)", block):
            title = re.search(r"title:\s*(.+(?:\n(?![ \t]+-)[ \t]+.*)*)", entry)
            url = re.search(r"url:\s*(\S+)", entry)
            note = re.search(r"note:\s*>?\s*\n?((?:[ \t]+.*\n?)*)", entry)
            if title and url:
                t = re.sub(r"\s*\n\s*", " ", title.group(1)).strip().strip('"')
                n = re.sub(r"\s*\n\s*", " ", note.group(1)).strip() if note else ""
                sources.append({
                    "title": t,
                    "url": url.group(1).strip(),
                    "note": n,
                })

    # Verdict keywords → enum
    raw_verdict = (fm.get("verdict") or "").upper()
    if "PARTIAL" in raw_verdict:
        verdict = "PARTIALLY"
    elif raw_verdict.startswith("SUPPORTED") or "FULLY" in raw_verdict:
        verdict = "SUPPORTED"
    elif "NOT" in raw_verdict:
        verdict = "NOT"
    else:
        verdict = "PARTIALLY"

    # Rationale + summary: split body on any ## or ### header, classify each section
    rationale = []
    summary = ""
    body = text[fm_match.end():] if fm_match else text
    # src_match offsets are absolute in `text` — convert to body-relative
    if src_match and src_match.start() >= (fm_match.end() if fm_match else 0):
        cut = src_match.start() - (fm_match.end() if fm_match else 0)
        body = body[:cut]
    sections = re.split(r"\n(?=#{2,3}\s)", body)
    for sec in sections:
        m = re.match(r"#{2,3}\s*(.+?)\s*\n(.*)", sec, re.S)
        if not m:
            continue
        label = m.group(1).strip()
        content = m.group(2).strip()
        if not content:
            continue
        if re.match(r"(bottom\s*line)", label, re.I):
            summary = re.sub(r"\s*\n\s*", " ", content)[:900]
            continue
        if label.lower().startswith("sources") or "verdict per sub" in label.lower():
            continue
        # sub-question sections: labels containing '(a)'..'(e)'
        if re.search(r"\(([a-e])\)", label):
            # verdict style 1: '... — SUPPORTED' suffix in the header (claim 1)
            vm = re.search(r"—\s*([A-Z][A-Z ]+)$", label)
            sub_verdict = vm.group(1).strip() if vm else ""
            # verdict style 2: '**Verdict: X**' inline (claims 2-3)
            if not sub_verdict:
                vm2 = re.search(r"\*\*Verdict:\s*([^*]+)\*\*", content)
                sub_verdict = vm2.group(1).strip() if vm2 else ""
                content = re.sub(r"\*\*Verdict:\s*[^*]+\*\*", "", content).strip()
            # strip 'Rationale:' prefix if present
            content = re.sub(r"^Rationale:\s*", "", content, flags=re.I).strip()
            clean_label = re.sub(r"\s*—\s*[A-Z][A-Z ]+$", "", label)
            rationale.append({
                "label": clean_label,
                "text": (f"[{sub_verdict}] " if sub_verdict else "") + content[:2000],
            })

    return {
        "verdict": verdict,
        "confidence": (fm.get("confidence") or "medium").lower(),
        "claim": fm.get("claim", ""),
        "summary": summary,
        "rationale": rationale,
        "sources": sources,
    }


def load_texts() -> list[tuple[int, str, str]]:
    """Return [(claim_id, slug, markdown)] — local dir first, then GitHub raw."""
    out = []
    for cid, slug, fname in CLAIM_FILES:
        local = LOCAL_DIR / fname
        if local.exists():
            out.append((cid, slug, local.read_text()))
            continue
        url = RAW_BASE + fname
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                out.append((cid, slug, r.read().decode()))
        except Exception as e:  # noqa: BLE001
            print(f"WARN: {fname} unavailable locally and at {url}: {e}",
                  file=sys.stderr)
    return out


def main():
    claims = []
    for cid, slug, md in load_texts():
        parsed = parse_claim_md(md)
        parsed["id"] = cid
        parsed["slug"] = slug
        claims.append(parsed)
    claims.sort(key=lambda c: c["id"])

    data = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "project": "Rural Healthcare Transformation — National Scope",
        "claims": claims,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=2))
    print(f"WROTE {OUT} with {len(claims)} claims")
    for c in claims:
        print(f"  claim {c['id']}: {c['verdict']} ({c['confidence']}) "
              f"— {len(c['sources'])} sources")


if __name__ == "__main__":
    main()
