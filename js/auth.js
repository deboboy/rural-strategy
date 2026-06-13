function getNextPath() {
  const next = new URLSearchParams(window.location.search).get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return '/';
  }
  return next;
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

document.querySelectorAll('[data-logout]').forEach((element) => {
  element.addEventListener('click', (event) => {
    event.preventDefault();
    logout();
  });
});

const loginForm = document.getElementById('login-form');
if (loginForm) {
  const errorEl = document.getElementById('login-error');
  const submitButton = loginForm.querySelector('button[type="submit"]');

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.hidden = true;
    submitButton.disabled = true;

    const formData = new FormData(loginForm);
    const username = formData.get('username');
    const password = formData.get('password');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        errorEl.textContent = payload.error || 'Sign in failed';
        errorEl.hidden = false;
        submitButton.disabled = false;
        return;
      }

      window.location.href = getNextPath();
    } catch {
      errorEl.textContent = 'Network error. Try again.';
      errorEl.hidden = false;
      submitButton.disabled = false;
    }
  });
}

async function showCurrentUser() {
  const label = document.querySelector('[data-user-label]');
  if (!label) return;

  try {
    const response = await fetch('/api/auth/me');
    if (!response.ok) return;
    const payload = await response.json();
    label.textContent = payload.user.displayName;
  } catch {
    // Ignore header label failures.
  }
}

showCurrentUser();
