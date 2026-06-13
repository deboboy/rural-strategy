import {
  buildSessionCookie,
  createSessionToken,
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
    return new Response(JSON.stringify({ error: 'Invalid username or password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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
