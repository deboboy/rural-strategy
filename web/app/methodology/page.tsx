import Link from "next/link";
import findings from "@/data/findings.json";

export default function Methodology() {
  const data = findings as { generated: string };
  return (
    <div className="container">
      <p style={{ marginBottom: "1rem" }}>
        <Link href="/">← All findings</Link>
      </p>
      <div className="header" style={{ paddingTop: 0 }}>
        <h1>Methodology</h1>
      </div>

      <div className="card">
        <h2>Research design</h2>
        <p className="finding">{`The Mi Salud rural care-coordination model makes three testable claims, each embedded in its proof-of-concept design:

1. Closed-loop referrals — CHW → nurse → provider → back to CHW, with every handoff tracked to completion.
2. Multimodal intake — patients complete clinical intake by voice, SMS, text, or handwritten notes, in their own language.
3. BYOD remote monitoring — patients' own phones/watches plus home diagnostic kits, streamed via a secure store-and-forward gateway.

For each claim, we asked four national-scope questions:
(a) Evidence — does national research support the claim's mechanism?
(b) Practice — is it already being done nationally, and by whom?
(c) Policy — do federal rules (CMS reimbursement, civil-rights mandates, broadband programs) permit or encourage it?
(d) Gap — what is NOT being done nationally that this model would add?

Each question is answered with a verdict (SUPPORTED / PARTIALLY / NOT) and cited sources. Verdicts use a three-level scale; confidence reflects source strength and consistency across questions.`}</p>
      </div>

      <div className="card">
        <h2>Source standards</h2>
        <p className="finding">{`Every factual claim links to a retrievable source (federal agency pages, peer-reviewed literature, national surveys, or named program pages). No number appears without a source note. Primary sources (CMS, HRSA, FCC, AHRQ, Pew Research) are preferred over secondary reporting.`}</p>
      </div>

      <div className="card">
        <h2>Limitations</h2>
        <p className="finding">{`This is a research synthesis, not a systematic review or meta-analysis. Search breadth is broad but not exhaustive; reimbursement rules vary by state and change frequently; national statistics can mask local variation. Where evidence is thin or contested, the verdict and confidence reflect that.`}</p>
      </div>

      <div className="card">
        <h2>Refresh</h2>
        <p className="finding">{`Findings were generated ${new Date(data.generated).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} and are refreshed weekly by an automated research pipeline that re-checks sources, adds new findings, and updates the verdicts when the national picture changes.`}</p>
      </div>
    </div>
  );
}
