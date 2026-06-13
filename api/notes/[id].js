import {
  deleteNote,
  getNoteById,
  updateNote,
} from '../../lib/db.js';
import {
  errorResponse,
  jsonResponse,
  normalizeBody,
  readJsonBody,
  requireSession,
} from '../../lib/api.js';

export const config = { runtime: 'edge' };

function getNoteId(request) {
  const match = new URL(request.url).pathname.match(/^\/api\/notes\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

export default async function handler(request) {
  const { user, response } = await requireSession(request);
  if (response) return response;

  const noteId = getNoteId(request);
  if (!noteId) {
    return errorResponse('Invalid note id', 400);
  }

  if (request.method === 'PATCH') {
    const body = await readJsonBody(request);
    if (!body) {
      return errorResponse('Invalid JSON body', 400);
    }

    const noteBody = normalizeBody(body.body);
    if (!noteBody) {
      return errorResponse('body is required', 400);
    }

    try {
      const existing = await getNoteById(noteId);
      if (!existing) {
        return errorResponse('Note not found', 404);
      }
      if (existing.author !== user.displayName) {
        return errorResponse('Forbidden', 403);
      }

      const note = await updateNote(noteId, noteBody);
      return jsonResponse({ note });
    } catch (error) {
      console.error('Failed to update note', error);
      return errorResponse('Failed to update note', 500);
    }
  }

  if (request.method === 'DELETE') {
    try {
      const existing = await getNoteById(noteId);
      if (!existing) {
        return errorResponse('Note not found', 404);
      }
      if (existing.author !== user.displayName) {
        return errorResponse('Forbidden', 403);
      }

      await deleteNote(noteId);
      return jsonResponse({ ok: true });
    } catch (error) {
      console.error('Failed to delete note', error);
      return errorResponse('Failed to delete note', 500);
    }
  }

  return errorResponse('Method not allowed', 405);
}
