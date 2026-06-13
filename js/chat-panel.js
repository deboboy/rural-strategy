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

function renderMarkdown(markdown) {
  if (!window.marked || !window.DOMPurify) {
    return `<p>${escapeHtml(markdown)}</p>`;
  }
  const raw = window.marked.parse(markdown, { breaks: true });
  return window.DOMPurify.sanitize(raw);
}

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getChatContext() {
  if (typeof window.getMapChatContext === 'function') {
    return window.getMapChatContext();
  }
  return { page: pagePath };
}

async function parseSseStream(response, handlers) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const lines = chunk.split('\n');
      let event = 'message';
      let data = '';

      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) data += line.slice(5).trim();
      }

      if (data) {
        handlers.onEvent?.(event, JSON.parse(data));
      }
      boundary = buffer.indexOf('\n\n');
    }
  }
}

function createPanelRoot() {
  const root = document.createElement('div');
  root.className = 'chat-panel-root';
  root.innerHTML = `
    <button type="button" class="chat-panel-backdrop" data-chat-close aria-label="Close chat"></button>
    <aside class="chat-panel" aria-label="Research assistant">
      <div class="chat-panel-header">
        <h2>Ask</h2>
        <div class="chat-panel-actions">
          <button type="button" data-chat-new>New</button>
          <button type="button" data-chat-close>Close</button>
        </div>
      </div>
      <div class="chat-panel-body">
        <div class="chat-conversations" data-chat-conversations></div>
        <div class="chat-messages" data-chat-messages></div>
        <p class="chat-status" data-chat-status hidden></p>
        <form class="chat-compose" data-chat-compose>
          <textarea name="message" required placeholder="Ask about clinics, networks, or outreach strategy…"></textarea>
          <button type="submit">Send</button>
        </form>
      </div>
    </aside>
  `;
  document.body.appendChild(root);
  return root;
}

function setStatus(root, message, isError = false) {
  const status = root.querySelector('[data-chat-status]');
  if (!message) {
    status.hidden = true;
    status.textContent = '';
    status.classList.toggle('chat-error', false);
    return;
  }
  status.hidden = false;
  status.textContent = message;
  status.classList.toggle('chat-error', isError);
}

function renderMessages(root, messages) {
  const container = root.querySelector('[data-chat-messages]');
  container.innerHTML = '';

  if (!messages.length) {
    container.innerHTML = '<p class="chat-empty">Ask about rural clinics, network clusters, or research briefs. The assistant uses project tools to fetch data.</p>';
    return;
  }

  for (const message of messages) {
    const item = document.createElement('article');
    item.className = `chat-message chat-message-${message.role}`;
    item.innerHTML = `
      <div class="chat-message-meta">${message.role === 'user' ? 'You' : 'Assistant'} · ${escapeHtml(formatDate(message.createdAt))}</div>
      <div class="chat-message-body">${renderMarkdown(message.content)}</div>
    `;
    container.appendChild(item);
  }

  container.scrollTop = container.scrollHeight;
}

function renderConversations(root, conversations, activeId) {
  const container = root.querySelector('[data-chat-conversations]');
  container.innerHTML = '';

  if (!conversations.length) {
    container.innerHTML = '<p class="chat-empty">No chats on this page yet.</p>';
    return;
  }

  for (const conversation of conversations) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chat-conversation-item';
    if (conversation.id === activeId) {
      button.classList.add('is-active');
    }
    button.textContent = conversation.title;
    button.addEventListener('click', () => {
      root.activeConversationId = conversation.id;
      loadConversation(root, conversation.id);
      renderConversations(root, conversations, conversation.id);
    });
    container.appendChild(button);
  }
}

async function loadConversations(root) {
  const response = await fetch(`/api/chat?page_path=${encodeURIComponent(pagePath)}`);
  if (!response.ok) {
    throw new Error('Failed to load conversations');
  }
  const payload = await response.json();
  root.conversations = payload.conversations;
  renderConversations(root, payload.conversations, root.activeConversationId);
}

async function loadConversation(root, conversationId) {
  const response = await fetch(`/api/chat/${conversationId}`);
  if (!response.ok) {
    throw new Error('Failed to load conversation');
  }
  const payload = await response.json();
  root.activeConversationId = payload.conversation.id;
  root.currentMessages = payload.messages;
  renderMessages(root, payload.messages);
}

async function sendMessage(root, message) {
  const form = root.querySelector('[data-chat-compose]');
  const button = form.querySelector('button');
  const textarea = form.querySelector('textarea');
  button.disabled = true;
  setStatus(root, 'Sending…');

  const payload = {
    page_path: pagePath,
    message,
    context: getChatContext(),
  };
  if (root.activeConversationId) {
    payload.conversation_id = root.activeConversationId;
  }

  const userBubble = {
    role: 'user',
    content: message,
    createdAt: new Date().toISOString(),
  };
  const priorMessages = root.currentMessages || [];
  const optimisticMessages = priorMessages.concat(userBubble);
  root.currentMessages = optimisticMessages;
  renderMessages(root, optimisticMessages);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || 'Chat request failed');
    }

    await parseSseStream(response, {
      onEvent: (event, data) => {
        if (event === 'status') {
          setStatus(root, data.message);
        }
        if (event === 'conversation') {
          root.activeConversationId = data.conversation.id;
        }
        if (event === 'message') {
          root.currentMessages = priorMessages.concat(userBubble, data.message);
          renderMessages(root, root.currentMessages);
        }
        if (event === 'error') {
          throw new Error(data.message || 'Chat failed');
        }
        if (event === 'done') {
          setStatus(root, '');
        }
      },
    });

    textarea.value = '';
    await loadConversations(root);
  } catch (error) {
    setStatus(root, error.message || 'Chat failed', true);
  } finally {
    button.disabled = false;
  }
}

function setPanelOpen(root, toggle, isOpen) {
  root.classList.toggle('is-open', isOpen);
  toggle.setAttribute('aria-expanded', String(isOpen));
  document.body.style.overflow = isOpen ? 'hidden' : '';
  if (isOpen) {
    loadConversations(root).catch(() => {
      setStatus(root, 'Could not load conversations.', true);
    });
    if (root.activeConversationId) {
      loadConversation(root, root.activeConversationId).catch(() => {
        setStatus(root, 'Could not load conversation.', true);
      });
    } else {
      root.currentMessages = [];
      renderMessages(root, []);
    }
  }
}

async function initChatPanel() {
  if (pagePath === '/login.html') return;

  const toggle = document.querySelector('[data-chat-toggle]');
  if (!toggle) return;

  const root = createPanelRoot();
  root.conversations = [];
  root.currentMessages = [];

  root.querySelectorAll('[data-chat-close]').forEach((button) => {
    button.addEventListener('click', () => setPanelOpen(root, toggle, false));
  });

  root.querySelector('[data-chat-new]').addEventListener('click', () => {
    root.activeConversationId = null;
    root.currentMessages = [];
    renderMessages(root, []);
    renderConversations(root, root.conversations, null);
  });

  toggle.addEventListener('click', () => {
    const isOpen = root.classList.contains('is-open');
    setPanelOpen(root, toggle, !isOpen);
  });

  root.querySelector('[data-chat-compose]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const textarea = event.currentTarget.querySelector('textarea');
    const message = textarea.value.trim();
    if (!message) return;
    await sendMessage(root, message);
  });
}

initChatPanel();
