import { next } from '@vercel/functions';
import { getSessionUser } from './lib/auth.js';

export const config = {
  matcher: ['/((?!styles/|js/).*)'],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname.startsWith('/api/auth/')) {
    return next();
  }

  const session = await getSessionUser(request);

  if (pathname === '/login.html') {
    if (session && request.method === 'GET') {
      const destination = url.searchParams.get('next') || '/';
      return Response.redirect(new URL(destination, request.url));
    }
    return next();
  }

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const loginUrl = new URL('/login.html', request.url);
    loginUrl.searchParams.set('next', pathname + url.search);
    return Response.redirect(loginUrl);
  }

  return next();
}
