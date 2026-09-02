export interface Source {
  title: string;
  url: string;
  note: string;
}

export interface Claim {
  id: number;
  slug: string;
  claim: string;
  verdict: "SUPPORTED" | "PARTIALLY" | "NOT";
  confidence: "high" | "medium" | "low";
  summary: string;
  rationale: { label: string; text: string }[];
  sources: Source[];
}

export interface FindingsData {
  generated: string;
  project: string;
  claims: Claim[];
}
