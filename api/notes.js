import {
  createNote,
  listNotesWithComments,
} from '../lib/db.js';
import {
  errorResponse,
  jsonResponse,
  normalizeBody,
  normalizePagePath,
  readJsonBody,
  requireSession,
} from '../lib/api.js';

export const config = { runtime: 'edge' };

export default async function handler(request) {
  const { user, response } = await requireSession(request);
  if (response) return response;

  if (request.method === 'GET') {
    const pagePath = normalizePagePath(new URL(request.url).searchParams.get('page_path'));
    if (!pagePath) {
      return errorResponse('page_path query parameter is required', 400);
    }

    try {
      const notes = await listNotesWithComments(pagePath);
      return jsonResponse({ notes });
    } catch (error) {
      console.error('Failed to list notes', error);
      return errorResponse('Failed to load notes', 500);
    }
  }

  if (request.method === 'POST') {
    const body = await readJsonBody(request);
    if (!body) {
      return errorResponse('Invalid JSON body', 400);
    }

    const pagePath = normalizePagePath(body.page_path);
    const noteBody = normalizeBody(body.body);
    if (!pagePath || !noteBody) {
      return errorResponse('page_path and body are required', 400);
    }

    try {
      const note = await createNote(pagePath, user.displayName, noteBody);
      return jsonResponse({ note }, 201);
    } catch (error) {
      console.error('Failed to create note', error);
      return errorResponse('Failed to create note', 500);
    }
  }

  return errorResponse('Method not allowed', 405);
}
