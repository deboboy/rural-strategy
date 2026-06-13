import { neon } from '@neondatabase/serverless';

function getSql() {
  const connectionString = process.env.POSTGRES_URL?.trim();
  if (!connectionString) {
    throw new Error('POSTGRES_URL is not configured');
  }
  return neon(connectionString);
}

export async function listConversations(userUsername, pagePath) {
  const sql = getSql();
  const rows = await sql`
    SELECT id, user_username, page_path, title, created_at, updated_at
    FROM conversations
    WHERE user_username = ${userUsername} AND page_path = ${pagePath}
    ORDER BY updated_at DESC
  `;
  return rows.map(formatConversation);
}

export async function createConversation(userUsername, pagePath, title) {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO conversations (user_username, page_path, title)
    VALUES (${userUsername}, ${pagePath}, ${title})
    RETURNING id, user_username, page_path, title, created_at, updated_at
  `;
  return formatConversation(rows[0]);
}

export async function getConversation(id, userUsername) {
  const sql = getSql();
  const rows = await sql`
    SELECT id, user_username, page_path, title, created_at, updated_at
    FROM conversations
    WHERE id = ${id} AND user_username = ${userUsername}
  `;
  return rows[0] ? formatConversation(rows[0]) : null;
}

export async function touchConversation(id) {
  const sql = getSql();
  await sql`
    UPDATE conversations
    SET updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function listMessages(conversationId) {
  const sql = getSql();
  const rows = await sql`
    SELECT id, conversation_id, role, content, metadata, created_at
    FROM messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC
  `;
  return rows.map(formatMessage);
}

export async function addMessage(conversationId, role, content, metadata = null) {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO messages (conversation_id, role, content, metadata)
    VALUES (${conversationId}, ${role}, ${content}, ${metadata ? JSON.stringify(metadata) : null})
    RETURNING id, conversation_id, role, content, metadata, created_at
  `;
  return formatMessage(rows[0]);
}

function formatConversation(row) {
  return {
    id: row.id,
    userUsername: row.user_username,
    pagePath: row.page_path,
    title: row.title,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function formatMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    metadata: row.metadata ?? null,
    createdAt: toIsoString(row.created_at),
  };
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function buildModelMessages(storedMessages) {
  return storedMessages.map((message) => {
    if (message.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: message.metadata?.tool_call_id,
        content: message.content,
      };
    }

    if (message.role === 'assistant' && message.metadata?.tool_calls) {
      return {
        role: 'assistant',
        content: message.content || null,
        tool_calls: message.metadata.tool_calls,
      };
    }

    return {
      role: message.role,
      content: message.content,
    };
  });
}

export function visibleMessages(storedMessages) {
  return storedMessages.filter((message) => message.role === 'user' || message.role === 'assistant');
}
