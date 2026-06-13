const pagePath = window.location.pathname;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[ch]));
}

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function renderMarkdown(markdown) {
  if (!window.marked || !window.DOMPurify) {
    return `<p>${escapeHtml(markdown)}</p>`;
  }
  const raw = window.marked.parse(markdown, { breaks: true });
  return window.DOMPurify.sanitize(raw);
}

async function fetchCurrentUser() {
  const response = await fetch('/api/auth/me');
  if (!response.ok) return null;
  const payload = await response.json();
  return payload.user;
}

function createPanelRoot() {
  const root = document.createElement('div');
  root.className = 'notes-panel-root';
  root.innerHTML = `
    <button type="button" class="notes-panel-backdrop" data-notes-close aria-label="Close notes"></button>
    <aside class="notes-panel" aria-label="Page notes">
      <div class="notes-panel-header">
        <h2>Notes</h2>
        <div class="notes-panel-actions">
          <button type="button" data-notes-refresh>Refresh</button>
          <button type="button" data-notes-close>Close</button>
        </div>
      </div>
      <div class="notes-panel-body">
        <form class="notes-compose" data-notes-compose>
          <label class="field">
            <span>New note (Markdown)</span>
            <textarea name="body" required placeholder="Add a note for this page…"></textarea>
          </label>
          <button type="submit">Add note</button>
        </form>
        <p class="notes-status" data-notes-status hidden></p>
        <div data-notes-list></div>
      </div>
    </aside>
  `;
  document.body.appendChild(root);
  return root;
}

function setStatus(root, message, isError = false) {
  const status = root.querySelector('[data-notes-status]');
  if (!message) {
    status.hidden = true;
    status.textContent = '';
    status.classList.toggle('notes-error', false);
    return;
  }
  status.hidden = false;
  status.textContent = message;
  status.classList.toggle('notes-error', isError);
  status.classList.toggle('notes-status', !isError);
}

function renderNoteCard(note, currentUser) {
  const card = document.createElement('article');
  card.className = 'note-card';
  card.dataset.noteId = String(note.id);

  const canEdit = currentUser && note.author === currentUser.displayName;
  const commentsHtml = note.comments.map((comment) => `
    <div class="comment-item" data-comment-id="${comment.id}">
      <div class="comment-item-meta"><strong>${escapeHtml(comment.author)}</strong> · ${escapeHtml(formatDate(comment.createdAt))}</div>
      <div class="comment-item-body">${renderMarkdown(comment.body)}</div>
    </div>
  `).join('');

  card.innerHTML = `
    <div class="note-card-meta">
      <strong>${escapeHtml(note.author)}</strong>
      <span>${escapeHtml(formatDate(note.createdAt))}</span>
      ${note.updatedAt !== note.createdAt ? `<span>Edited ${escapeHtml(formatDate(note.updatedAt))}</span>` : ''}
    </div>
    <div class="note-card-body" data-note-body>${renderMarkdown(note.body)}</div>
    ${canEdit ? `
      <div class="note-card-actions">
        <button type="button" data-action="edit">Edit</button>
        <button type="button" data-action="delete">Delete</button>
      </div>
    ` : ''}
    <section class="note-comments">
      <h3>Comments (${note.comments.length})</h3>
      ${commentsHtml || '<p class="notes-empty">No comments yet.</p>'}
      <form class="comment-form" data-comment-form>
        <textarea name="body" required placeholder="Add a comment…"></textarea>
        <button type="submit">Comment</button>
      </form>
    </section>
  `;

  if (canEdit) {
    card.querySelector('[data-action="edit"]').addEventListener('click', () => {
      startEditNote(card, note);
    });
    card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      if (!window.confirm('Delete this note and its comments?')) return;
      await deleteNote(note.id, card.closest('.notes-panel-root'));
    });
  }

  card.querySelector('[data-comment-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const textarea = form.querySelector('textarea');
    const body = textarea.value.trim();
    if (!body) return;

    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const response = await fetch(`/api/notes/${note.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!response.ok) {
        throw new Error('Failed to add comment');
      }
      textarea.value = '';
      await loadNotes(card.closest('.notes-panel-root'));
    } catch {
      setStatus(card.closest('.notes-panel-root'), 'Could not add comment.', true);
    } finally {
      button.disabled = false;
    }
  });

  return card;
}

function startEditNote(card, note) {
  const bodyEl = card.querySelector('[data-note-body]');
  const actions = card.querySelector('.note-card-actions');
  actions.hidden = true;

  const form = document.createElement('form');
  form.className = 'note-edit-form';
  form.innerHTML = `
    <textarea name="body" required></textarea>
    <button type="submit">Save</button>
    <button type="button" data-action="cancel">Cancel</button>
  `;
  form.querySelector('textarea').value = note.body;

  bodyEl.replaceWith(form);

  form.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    loadNotes(card.closest('.notes-panel-root'));
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = form.querySelector('textarea').value.trim();
    if (!body) return;

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!response.ok) {
        throw new Error('Failed to update note');
      }
      await loadNotes(card.closest('.notes-panel-root'));
    } catch {
      setStatus(card.closest('.notes-panel-root'), 'Could not save note.', true);
    } finally {
      button.disabled = false;
    }
  });
}

async function deleteNote(noteId, root) {
  setStatus(root, 'Deleting note…');
  try {
    const response = await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error('Failed to delete note');
    }
    await loadNotes(root);
    setStatus(root, '');
  } catch {
    setStatus(root, 'Could not delete note.', true);
  }
}

async function loadNotes(root) {
  const list = root.querySelector('[data-notes-list]');
  list.innerHTML = '<p class="notes-status">Loading notes…</p>';

  try {
    const response = await fetch(`/api/notes?page_path=${encodeURIComponent(pagePath)}`);
    if (!response.ok) {
      throw new Error('Failed to load notes');
    }
    const payload = await response.json();
    list.innerHTML = '';

    if (payload.notes.length === 0) {
      list.innerHTML = '<p class="notes-empty">No notes on this page yet.</p>';
      return;
    }

    for (const note of payload.notes) {
      list.appendChild(renderNoteCard(note, root.currentUser));
    }
  } catch {
    list.innerHTML = '<p class="notes-error">Could not load notes.</p>';
  }
}

function setPanelOpen(root, toggle, isOpen) {
  root.classList.toggle('is-open', isOpen);
  toggle.setAttribute('aria-expanded', String(isOpen));
  document.body.style.overflow = isOpen ? 'hidden' : '';
  if (isOpen) {
    loadNotes(root);
  }
}

async function initNotesPanel() {
  if (pagePath === '/login.html') return;

  const toggle = document.querySelector('[data-notes-toggle]');
  if (!toggle) return;

  const root = createPanelRoot();
  root.currentUser = await fetchCurrentUser();

  const closeButtons = root.querySelectorAll('[data-notes-close]');
  closeButtons.forEach((button) => {
    button.addEventListener('click', () => setPanelOpen(root, toggle, false));
  });

  root.querySelector('[data-notes-refresh]').addEventListener('click', () => {
    loadNotes(root);
  });

  toggle.addEventListener('click', () => {
    const isOpen = root.classList.contains('is-open');
    setPanelOpen(root, toggle, !isOpen);
  });

  root.querySelector('[data-notes-compose]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const textarea = form.querySelector('textarea');
    const body = textarea.value.trim();
    if (!body) return;

    const button = form.querySelector('button');
    button.disabled = true;
    setStatus(root, 'Saving note…');

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_path: pagePath, body }),
      });
      if (!response.ok) {
        throw new Error('Failed to create note');
      }
      textarea.value = '';
      setStatus(root, '');
      await loadNotes(root);
    } catch {
      setStatus(root, 'Could not save note.', true);
    } finally {
      button.disabled = false;
    }
  });
}

initNotesPanel();
