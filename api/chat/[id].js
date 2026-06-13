import {
  getConversation,
  listMessages,
  visibleMessages,
} from '../../lib/chat-db.js';
import {
  errorResponse,
  jsonResponse,
  requireSession,
} from '../../lib/api.js';

export const config = { runtime: 'edge' };

function getConversationId(request) {
  const match = new URL(request.url).pathname.match(/^\/api\/chat\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

export default async function handler(request) {
  const { user, response } = await requireSession(request);
  if (response) return response;

  if (request.method !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  const conversationId = getConversationId(request);
  if (!conversationId) {
    return errorResponse('Invalid conversation id', 400);
  }

  try {
    const conversation = await getConversation(conversationId, user.username);
    if (!conversation) {
      return errorResponse('Conversation not found', 404);
    }

    const messages = await listMessages(conversationId);
    return jsonResponse({
      conversation,
      messages: visibleMessages(messages),
    });
  } catch (error) {
    console.error('Failed to load conversation', error);
    return errorResponse('Failed to load conversation', 500);
  }
}
