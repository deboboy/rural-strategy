import { readFileSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = process.cwd();
const docsDir = join(root, 'docs');

const DOC_FILES = {
  researchBrief: 'rural-wa-farmworker-social-graph-research-brief.md',
  socialGraphSummary: 'social-graph-research-summary.md',
  networkSummary: 'wa-rural-clinic-network-summary.csv',
  networkNodes: 'wa-rural-clinic-networks.csv',
  networkGeojson: 'wa-rural-clinic-networks.geojson',
  networkMarkdown: 'wa-rural-clinic-networks.md',
};

function readDoc(relativePath) {
  return readFileSync(join(docsDir, relativePath), 'utf8');
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
  return { headers, rows };
}

function splitCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

function extractMarkdownSection(markdown, section) {
  if (!section) {
    return markdown.slice(0, 12000);
  }

  const headingPattern = new RegExp(`^#{1,3}\\s+${escapeRegExp(section)}\\s*$`, 'im');
  const match = markdown.match(headingPattern);
  if (!match) {
    return null;
  }

  const start = match.index;
  const rest = markdown.slice(start + match[0].length);
  const nextHeading = rest.search(/^#{1,3}\s+/m);
  const body = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  return `# ${section}\n${body.trim()}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getNetworkSummary({ limit = 20, query } = {}) {
  const parsed = parseCsv(readDoc(DOC_FILES.networkSummary));
  let rows = parsed.rows;

  if (query) {
    const needle = String(query).trim().toLowerCase();
    rows = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
  }

  return {
    total: rows.length,
    items: rows.slice(0, limit),
  };
}

export function getNetworkNodes({ networkName, county, limit = 25 } = {}) {
  const parsed = parseCsv(readDoc(DOC_FILES.networkNodes));
  let rows = parsed.rows;

  if (networkName) {
    const needle = String(networkName).trim().toLowerCase();
    rows = rows.filter((row) => String(row.network_name || '').toLowerCase().includes(needle));
  }

  if (county) {
    const needle = String(county).trim().toLowerCase();
    rows = rows.filter((row) => String(row.county || '').toLowerCase().includes(needle));
  }

  return {
    total: rows.length,
    items: rows.slice(0, limit).map((row) => ({
      networkName: row.network_name,
      clinicName: row.clinic_name,
      city: row.city,
      county: row.county,
      regionScope: row.region_scope,
      lat: row.lat,
      lon: row.lon,
      phone: row.phone,
    })),
  };
}

export function getResearchBrief({ section } = {}) {
  const markdown = readDoc(DOC_FILES.researchBrief);
  const content = extractMarkdownSection(markdown, section) ?? markdown.slice(0, 12000);
  return {
    section: section || 'full (truncated)',
    content,
  };
}

export function getSocialGraphSummary() {
  return {
    content: readDoc(DOC_FILES.socialGraphSummary),
  };
}

export function searchDocs({ query, limit = 12 } = {}) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) {
    throw new Error('query is required');
  }

  const results = [];
  const files = readdirSync(docsDir).filter((name) => ['.md', '.csv', '.txt'].includes(extname(name)));

  for (const file of files) {
    const content = readDoc(file);
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (!lines[index].toLowerCase().includes(needle)) continue;
      const snippet = lines.slice(Math.max(0, index - 1), index + 3).join('\n').trim();
      results.push({
        file: `docs/${file}`,
        line: index + 1,
        snippet: snippet.slice(0, 500),
      });
      if (results.length >= limit) {
        return { query: needle, results };
      }
    }
  }

  return { query: needle, results };
}

export function listDocInventory() {
  return Object.entries(DOC_FILES).map(([key, file]) => ({ key, file: `docs/${file}` }));
}
