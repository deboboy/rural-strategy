import { getSessionUser } from './auth.js';

export function getRequestUrl(request) {
  const rawUrl = typeof request.url === 'string' ? request.url : '/';
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return new URL(rawUrl);
  }

  let host = 'localhost';
  if (typeof request.headers?.get === 'function') {
    host = request.headers.get('host') || host;
  } else if (request.headers?.host) {
    host = request.headers.host;
  }

  const protocol = request.headers?.['x-forwarded-proto'] || 'http';
  return new URL(rawUrl, `${protocol}://${host}`);
}

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

export async function requireSessionNode(req, res) {
  const user = await getSessionUser(req);
  if (!user) {
    sendJson(res, { error: 'Unauthorized' }, 401);
    return { user: null, denied: true };
  }
  return { user, denied: false };
}

export function sendJson(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export function sendError(res, message, status) {
  sendJson(res, { error: message }, status);
}

export async function readJsonBody(request) {
  if (typeof request.json === 'function') {
    try {
      return await request.json();
    } catch {
      return null;
    }
  }

  if (request.body && typeof request.body === 'object') {
    return request.body;
  }

  return new Promise((resolve) => {
    let data = '';
    request.on('data', (chunk) => {
      data += chunk;
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(null);
      }
    });
    request.on('error', () => resolve(null));
  });
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
