import {
  getConversation,
  listMessages,
  visibleMessages,
} from '../../lib/chat-db.js';
import {
  getRequestUrl,
  requireSessionNode,
  sendError,
  sendJson,
} from '../../lib/api.js';

function getConversationId(req) {
  const match = getRequestUrl(req).pathname.match(/^\/api\/chat\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

export default async function handler(req, res) {
  const { user, denied } = await requireSessionNode(req, res);
  if (denied) return;

  if (req.method !== 'GET') {
    sendError(res, 'Method not allowed', 405);
    return;
  }

  const conversationId = getConversationId(req);
  if (!conversationId) {
    sendError(res, 'Invalid conversation id', 400);
    return;
  }

  try {
    const conversation = await getConversation(conversationId, user.username);
    if (!conversation) {
      sendError(res, 'Conversation not found', 404);
      return;
    }

    const messages = await listMessages(conversationId);
    sendJson(res, {
      conversation,
      messages: visibleMessages(messages),
    });
  } catch (error) {
    console.error('Failed to load conversation', error);
    sendError(res, 'Failed to load conversation', 500);
  }
}
