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
  errorResponse,
  jsonResponse,
  normalizeBody,
  normalizePagePath,
  readJsonBody,
  requireSession,
} from '../lib/api.js';
import { buildSystemPrompt } from '../lib/agent/system-prompt.js';
import { encodeSse, runChatAgent, sseHeaders } from '../lib/agent/openrouter.js';

export const config = { runtime: 'edge' };

function conversationTitle(message) {
  const trimmed = message.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 60) return trimmed;
  return `${trimmed.slice(0, 57)}…`;
}

export default async function handler(request) {
  const { user, response } = await requireSession(request);
  if (response) return response;

  if (request.method === 'GET') {
    const pagePath = normalizePagePath(new URL(request.url).searchParams.get('page_path'));
    if (!pagePath) {
      return errorResponse('page_path query parameter is required', 400);
    }

    try {
      const conversations = await listConversations(user.username, pagePath);
      return jsonResponse({ conversations });
    } catch (error) {
      console.error('Failed to list conversations', error);
      return errorResponse('Failed to load conversations', 500);
    }
  }

  if (request.method === 'POST') {
    const body = await readJsonBody(request);
    if (!body) {
      return errorResponse('Invalid JSON body', 400);
    }

    const pagePath = normalizePagePath(body.page_path);
    const message = normalizeBody(body.message);
    if (!pagePath || !message) {
      return errorResponse('page_path and message are required', 400);
    }

    const context = body.context && typeof body.context === 'object' ? body.context : null;

    try {
      let conversation;
      if (body.conversation_id) {
        conversation = await getConversation(Number(body.conversation_id), user.username);
        if (!conversation) {
          return errorResponse('Conversation not found', 404);
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

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const send = (event, data) => {
            controller.enqueue(encoder.encode(encodeSse(event, data)));
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
            controller.close();
          }
        },
      });

      return new Response(stream, { headers: sseHeaders() });
    } catch (error) {
      console.error('Failed to start chat', error);
      return errorResponse('Failed to start chat', 500);
    }
  }

  return errorResponse('Method not allowed', 405);
}
