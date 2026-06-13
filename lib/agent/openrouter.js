import { executeTool, toolDefinitions } from './tools.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_ROUNDS = 8;

function getApiKey() {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }
  return key;
}

export function getModel() {
  return process.env.OPENROUTER_MODEL?.trim() || 'openai/gpt-4o-mini';
}

function openRouterHeaders() {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://rural-strategy.vercel.app',
    'X-Title': 'Washington Rural Strategy',
  };
}

async function callOpenRouter(body) {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: openRouterHeaders(),
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error?.message || payload.error || 'OpenRouter request failed';
    throw new Error(message);
  }

  return payload;
}

export async function runChatAgent({ messages, onStatus }) {
  let currentMessages = [...messages];
  const persistedMessages = [];

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    onStatus?.('Thinking…');

    const payload = await callOpenRouter({
      model: getModel(),
      messages: currentMessages,
      tools: toolDefinitions,
      stream: false,
    });

    const choice = payload.choices?.[0]?.message;
    if (!choice) {
      throw new Error('No response from model');
    }

    if (choice.tool_calls?.length) {
      const assistantWithTools = {
        role: 'assistant',
        content: choice.content || null,
        tool_calls: choice.tool_calls,
      };
      currentMessages.push(assistantWithTools);
      persistedMessages.push(assistantWithTools);

      for (const toolCall of choice.tool_calls) {
        const toolName = toolCall.function?.name;
        onStatus?.(`Using ${toolName || 'tool'}…`);

        let args = {};
        try {
          args = JSON.parse(toolCall.function?.arguments || '{}');
        } catch {
          args = {};
        }

        let result;
        try {
          result = await executeTool(toolName, args);
        } catch (error) {
          result = { error: error.message || 'Tool execution failed' };
        }

        const toolMessage = {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        };
        currentMessages.push(toolMessage);
        persistedMessages.push(toolMessage);
      }

      continue;
    }

    const assistantMessage = {
      role: 'assistant',
      content: choice.content || '',
    };
    persistedMessages.push(assistantMessage);

    return {
      assistantMessage,
      persistedMessages,
    };
  }

  throw new Error('Agent exceeded maximum tool rounds');
}

export function sseHeaders() {
  return {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  };
}

export function encodeSse(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
