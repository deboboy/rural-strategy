import {
  createComment,
  getNoteById,
} from '../../../lib/db.js';
import {
  errorResponse,
  jsonResponse,
  normalizeBody,
  readJsonBody,
  requireSession,
} from '../../../lib/api.js';

export const config = { runtime: 'edge' };

function getNoteId(request) {
  const match = new URL(request.url).pathname.match(/^\/api\/notes\/(\d+)\/comments\/?$/);
  return match ? Number(match[1]) : null;
}

export default async function handler(request) {
  const { user, response } = await requireSession(request);
  if (response) return response;

  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const noteId = getNoteId(request);
  if (!noteId) {
    return errorResponse('Invalid note id', 400);
  }

  const body = await readJsonBody(request);
  if (!body) {
    return errorResponse('Invalid JSON body', 400);
  }

  const commentBody = normalizeBody(body.body);
  if (!commentBody) {
    return errorResponse('body is required', 400);
  }

  try {
    const note = await getNoteById(noteId);
    if (!note) {
      return errorResponse('Note not found', 404);
    }

    const comment = await createComment(noteId, user.displayName, commentBody);
    return jsonResponse({ comment }, 201);
  } catch (error) {
    console.error('Failed to create comment', error);
    return errorResponse('Failed to create comment', 500);
  }
}
