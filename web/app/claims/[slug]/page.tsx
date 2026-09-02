import Link from "next/link";
import { notFound } from "next/navigation";
import findings from "@/data/findings.json";
import type { Claim } from "@/lib/types";

const VERDICT_CLASS: Record<string, string> = {
  SUPPORTED: "badge-supported",
  PARTIALLY: "badge-partially",
  NOT: "badge-not",
};

export function generateStaticParams() {
  return (findings as { claims: Claim[] }).claims.map((c) => ({
    slug: c.slug,
  }));
}

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = (await params) as { slug: string };
  const claim = (findings as { claims: Claim[] }).claims.find(
    (c) => c.slug === slug
  );
  if (!claim) notFound();

  return (
    <div className="container">
      <p style={{ marginBottom: "1rem" }}>
        <Link href="/">← All findings</Link>
      </p>
      <div className="header" style={{ paddingTop: 0 }}>
        <h1>
          Claim {claim.id}{" "}
          <span className={`badge ${VERDICT_CLASS[claim.verdict] ?? ""}`}>
            {claim.verdict}
          </span>
        </h1>
        <p className="sub">{claim.claim}</p>
      </div>

      <div className="card">
        <h2>Verdict</h2>
        <p className="finding">{claim.summary}</p>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          Confidence: <strong>{claim.confidence}</strong>
        </p>
      </div>

      {claim.rationale?.map((r) => (
        <div className="card" key={r.label}>
          <h2>{r.label}</h2>
          <p className="finding">{r.text}</p>
        </div>
      ))}

      <div className="card">
        <h2>Sources ({claim.sources?.length ?? 0})</h2>
        <ul className="sources">
          {(claim.sources ?? []).map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.title}
              </a>
              <br />
              <span className="note">{s.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
