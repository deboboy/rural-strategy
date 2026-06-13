export function buildSystemPrompt({ pagePath, mapContext }) {
  const contextLines = [
    'You are the Washington Rural Strategy research assistant for Frank and Leo.',
    'You help analyze rural health clinic locations, clinic networks, and farmworker outreach research for Washington State.',
    'Use the available tools to fetch structured project data before answering factual questions.',
    'Do not invent clinic locations, network stats, or research claims. If data is missing, say so clearly.',
    'Prefer concise, actionable answers with county/region context when relevant.',
    'Sensitive docs stay server-side; summarize findings without exposing private community details.',
  ];

  if (pagePath) {
    contextLines.push(`The user is currently on page: ${pagePath}`);
  }

  if (mapContext?.viewport) {
    const { center, zoom, bounds } = mapContext.viewport;
    contextLines.push(
      `Map viewport: center ${JSON.stringify(center)}, zoom ${zoom}, bounds ${JSON.stringify(bounds)}`
    );
  }

  if (mapContext?.selectedClinic) {
    contextLines.push(`Selected clinic context: ${JSON.stringify(mapContext.selectedClinic)}`);
  }

  return contextLines.join('\n');
}
