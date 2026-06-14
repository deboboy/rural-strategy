import {
  buildSessionCookie,
  createSessionToken,
  diagnoseLoginFailure,
  getAuthDiagnostics,
  validateCredentials,
} from '../../lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = validateCredentials(body.username, body.password);
  if (!user) {
    const failure = diagnoseLoginFailure(body.username, body.password);
    const diagnostics = getAuthDiagnostics();
    console.error('[auth/login] rejected', JSON.stringify({ failure, diagnostics }));

    return new Response(JSON.stringify({ error: 'Invalid username or password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.info('[auth/login] success', JSON.stringify({ username: user.username }));

  const token = await createSessionToken(user);

  return new Response(
    JSON.stringify({
      user: {
        username: user.username,
        displayName: user.displayName,
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': buildSessionCookie(token),
      },
    }
  );
}
