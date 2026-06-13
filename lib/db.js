import { neon } from '@neondatabase/serverless';

function getSql() {
  const connectionString = process.env.POSTGRES_URL?.trim();
  if (!connectionString) {
    throw new Error('POSTGRES_URL is not configured');
  }
  return neon(connectionString);
}

export async function listNotesWithComments(pagePath) {
  const sql = getSql();
  const notes = await sql`
    SELECT id, page_path, author, body, created_at, updated_at
    FROM notes
    WHERE page_path = ${pagePath}
    ORDER BY created_at DESC
  `;

  if (notes.length === 0) {
    return [];
  }

  const noteIds = notes.map((row) => row.id);
  const comments = await sql`
    SELECT id, note_id, author, body, created_at
    FROM comments
    WHERE note_id = ANY(${noteIds})
    ORDER BY created_at ASC
  `;

  const commentsByNote = new Map();
  for (const comment of comments) {
    const list = commentsByNote.get(comment.note_id) || [];
    list.push(formatComment(comment));
    commentsByNote.set(comment.note_id, list);
  }

  return notes.map((row) => ({
    ...formatNote(row),
    comments: commentsByNote.get(row.id) || [],
  }));
}

export async function createNote(pagePath, author, body) {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO notes (page_path, author, body)
    VALUES (${pagePath}, ${author}, ${body})
    RETURNING id, page_path, author, body, created_at, updated_at
  `;
  return { ...formatNote(rows[0]), comments: [] };
}

export async function getNoteById(id) {
  const sql = getSql();
  const rows = await sql`
    SELECT id, page_path, author, body, created_at, updated_at
    FROM notes
    WHERE id = ${id}
  `;
  return rows[0] ? formatNote(rows[0]) : null;
}

export async function updateNote(id, body) {
  const sql = getSql();
  const rows = await sql`
    UPDATE notes
    SET body = ${body}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, page_path, author, body, created_at, updated_at
  `;
  return rows[0] ? formatNote(rows[0]) : null;
}

export async function deleteNote(id) {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM notes
    WHERE id = ${id}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function createComment(noteId, author, body) {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO comments (note_id, author, body)
    VALUES (${noteId}, ${author}, ${body})
    RETURNING id, note_id, author, body, created_at
  `;
  return formatComment(rows[0]);
}

export async function getCommentById(id) {
  const sql = getSql();
  const rows = await sql`
    SELECT id, note_id, author, body, created_at
    FROM comments
    WHERE id = ${id}
  `;
  return rows[0] ? formatComment(rows[0]) : null;
}

export async function deleteComment(id) {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM comments
    WHERE id = ${id}
    RETURNING id
  `;
  return rows.length > 0;
}

function formatNote(row) {
  return {
    id: row.id,
    pagePath: row.page_path,
    author: row.author,
    body: row.body,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function formatComment(row) {
  return {
    id: row.id,
    noteId: row.note_id,
    author: row.author,
    body: row.body,
    createdAt: toIsoString(row.created_at),
  };
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
