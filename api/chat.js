import {
  addMessage,
  buildModelMessages,
  createConversation,
  getConversation,
  listConversations,
  listMessages,
  touchConversation,
} from '../lib/chat-db.js';
import {
  getRequestUrl,
  normalizeBody,
  normalizePagePath,
  readJsonBody,
  requireSessionNode,
  sendError,
  sendJson,
} from '../lib/api.js';
import { buildSystemPrompt } from '../lib/agent/system-prompt.js';
import { encodeSse, runChatAgent, sseHeaders } from '../lib/agent/openrouter.js';

function conversationTitle(message) {
  const trimmed = message.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 60) return trimmed;
  return `${trimmed.slice(0, 57)}…`;
}

export default async function handler(req, res) {
  const { user, denied } = await requireSessionNode(req, res);
  if (denied) return;

  if (req.method === 'GET') {
    const pagePath = normalizePagePath(getRequestUrl(req).searchParams.get('page_path'));
    if (!pagePath) {
      sendError(res, 'page_path query parameter is required', 400);
      return;
    }

    try {
      const conversations = await listConversations(user.username, pagePath);
      sendJson(res, { conversations });
    } catch (error) {
      console.error('Failed to list conversations', error);
      sendError(res, 'Failed to load conversations', 500);
    }
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    if (!body) {
      sendError(res, 'Invalid JSON body', 400);
      return;
    }

    const pagePath = normalizePagePath(body.page_path);
    const message = normalizeBody(body.message);
    if (!pagePath || !message) {
      sendError(res, 'page_path and message are required', 400);
      return;
    }

    const context = body.context && typeof body.context === 'object' ? body.context : null;

    try {
      let conversation;
      if (body.conversation_id) {
        conversation = await getConversation(Number(body.conversation_id), user.username);
        if (!conversation) {
          sendError(res, 'Conversation not found', 404);
          return;
        }
      } else {
        conversation = await createConversation(user.username, pagePath, conversationTitle(message));
      }

      await addMessage(conversation.id, 'user', message, {
        mapContext: context,
        pagePath,
      });

      const storedMessages = await listMessages(conversation.id);
      const modelMessages = [
        {
          role: 'system',
          content: buildSystemPrompt({ pagePath, mapContext: context }),
        },
        ...buildModelMessages(storedMessages),
      ];

      res.writeHead(200, sseHeaders());
      const send = (event, data) => {
        res.write(encodeSse(event, data));
      };

      try {
        send('conversation', { conversation });
        const { persistedMessages } = await runChatAgent({
          messages: modelMessages,
          onStatus: (status) => send('status', { message: status }),
        });

        let savedAssistant = null;
        for (const entry of persistedMessages) {
          if (entry.role === 'tool') {
            await addMessage(conversation.id, 'tool', entry.content, {
              tool_call_id: entry.tool_call_id,
            });
            continue;
          }

          savedAssistant = await addMessage(
            conversation.id,
            'assistant',
            entry.content || '',
            entry.tool_calls ? { tool_calls: entry.tool_calls } : null
          );
        }

        await touchConversation(conversation.id);
        send('message', { message: savedAssistant });
        send('done', { conversationId: conversation.id });
      } catch (error) {
        console.error('Chat agent failed', error);
        send('error', { message: error.message || 'Chat failed' });
      } finally {
        res.end();
      }
    } catch (error) {
      console.error('Failed to start chat', error);
      sendError(res, 'Failed to start chat', 500);
    }
    return;
  }

  sendError(res, 'Method not allowed', 405);
}
