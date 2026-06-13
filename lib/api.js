import { getSessionUser } from './auth.js';

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

export function errorResponse(message, status) {
  return jsonResponse({ error: message }, status);
}

export async function requireSession(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return { user: null, response: errorResponse('Unauthorized', 401) };
  }
  return { user, response: null };
}

export async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function normalizePagePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) {
    return null;
  }
  if (value.startsWith('//')) {
    return null;
  }
  return value.split('?')[0].split('#')[0];
}

export function normalizeBody(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
