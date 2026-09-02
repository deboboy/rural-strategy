import Link from "next/link";
import findings from "@/data/findings.json";
import type { Claim } from "@/lib/types";

const VERDICT_CLASS: Record<string, string> = {
  SUPPORTED: "badge-supported",
  PARTIALLY: "badge-partially",
  NOT: "badge-not",
};

export default function Home() {
  const data = findings as {
    generated: string;
    claims: (Claim & { verdict: string })[];
  };

  const supported = data.claims.filter((c) => c.verdict === "SUPPORTED").length;
  const partial = data.claims.filter((c) => c.verdict === "PARTIALLY").length;
  const totalSources = data.claims.reduce(
    (acc, c) => acc + (c.sources?.length ?? 0),
    0
  );

  return (
    <div className="container">
      <div className="header">
        <h1>Rural Healthcare Transformation — National Scope</h1>
        <p className="sub">
          Does the Mi Salud rural care-coordination model hold up nationally? We
          took the three claims behind its proof of concept — closed-loop
          referrals, multimodal native-language intake, and BYOD remote
          monitoring — and tested each against national evidence, existing
          programs, and federal policy.
        </p>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="n">{data.claims.length}</div>
          <div className="l">model claims tested</div>
        </div>
        <div className="kpi">
          <div className="n">
            {supported} + {partial}
          </div>
          <div className="l">supported + partially supported</div>
        </div>
        <div className="kpi">
          <div className="n">{totalSources}</div>
          <div className="l">cited national sources</div>
        </div>
        <div className="kpi">
          <div className="n">{new Date(data.generated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
          <div className="l">findings last refreshed</div>
        </div>
      </div>

      {data.claims.map((claim) => (
        <div className="card" key={claim.id}>
          <h2>
            <span className={`badge ${VERDICT_CLASS[claim.verdict] ?? ""}`}>
              {claim.verdict}
            </span>
            &nbsp; Claim {claim.id}
          </h2>
          <p className="claim">{claim.claim}</p>
          <div className="verdict-line">
            <strong>{claim.confidence}</strong> confidence ·{" "}
            {claim.sources?.length ?? 0} sources ·{" "}
            <Link href={`/claims/${claim.slug}`}>full findings →</Link>
          </div>
          <p className="finding">{claim.summary}</p>
        </div>
      ))}

      <div className="footer">
        Research by the Mi Salud team · Produced with Hermes Agent ·{" "}
        <Link href="/methodology">Methodology</Link> ·{" "}
        <a href="https://github.com/deboboy/rural-strategy/tree/national-scope">
          Source repo
        </a>
      </div>
      <p className="meta">
        Findings are research synthesis, not medical or legal advice. Sources
        are cited per claim; refresh cadence is weekly via automated research
        sync.
      </p>
    </div>
  );
}
