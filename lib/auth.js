import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'rural_session';
export const SESSION_DAYS = 7;
const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

function getSecretKey() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error('SESSION_SECRET is not configured');
  }
  return new TextEncoder().encode(secret);
}

function safeEqual(a, b) {
  const left = new TextEncoder().encode(String(a));
  const right = new TextEncoder().encode(String(b));
  if (left.length !== right.length) {
    let pad = 0;
    for (let i = 0; i < left.length; i++) {
      pad |= left[i] ^ left[i];
    }
    return false;
  }
  let result = 0;
  for (let i = 0; i < left.length; i++) {
    result |= left[i] ^ right[i];
  }
  return result === 0;
}

export function getUsers() {
  const users = [];

  if (process.env.AUTH_USER_FRANK && process.env.AUTH_PASS_FRANK) {
    users.push({
      id: 'frank',
      username: process.env.AUTH_USER_FRANK.trim(),
      password: process.env.AUTH_PASS_FRANK.trim(),
      displayName: (process.env.AUTH_DISPLAY_FRANK || process.env.AUTH_USER_FRANK).trim(),
    });
  }

  if (process.env.AUTH_USER_LEO && process.env.AUTH_PASS_LEO) {
    users.push({
      id: 'leo',
      username: process.env.AUTH_USER_LEO.trim(),
      password: process.env.AUTH_PASS_LEO.trim(),
      displayName: (process.env.AUTH_DISPLAY_LEO || process.env.AUTH_USER_LEO).trim(),
    });
  }

  return users;
}

export function getAuthDiagnostics() {
  const frankPassRaw = process.env.AUTH_PASS_FRANK;
  const leoPassRaw = process.env.AUTH_PASS_LEO;

  return {
    sessionSecretConfigured: Boolean(process.env.SESSION_SECRET?.trim()),
    vercelEnv: process.env.VERCEL_ENV || null,
    configuredUserCount: getUsers().length,
    configuredUsernames: getUsers().map((entry) => entry.username),
    frank: {
      userConfigured: Boolean(process.env.AUTH_USER_FRANK?.trim()),
      passConfigured: Boolean(frankPassRaw),
      passRawLength: frankPassRaw?.length ?? 0,
      passTrimmedLength: frankPassRaw?.trim().length ?? 0,
      passHadWhitespace: frankPassRaw ? frankPassRaw !== frankPassRaw.trim() : false,
      username: process.env.AUTH_USER_FRANK?.trim() || null,
    },
    leo: {
      userConfigured: Boolean(process.env.AUTH_USER_LEO?.trim()),
      passConfigured: Boolean(leoPassRaw),
      passRawLength: leoPassRaw?.length ?? 0,
      passTrimmedLength: leoPassRaw?.trim().length ?? 0,
      passHadWhitespace: leoPassRaw ? leoPassRaw !== leoPassRaw.trim() : false,
      username: process.env.AUTH_USER_LEO?.trim() || null,
    },
  };
}

export function diagnoseLoginFailure(username, password) {
  const normalizedUsername = String(username ?? '').trim().toLowerCase();
  const providedPassword = String(password ?? '');
  const trimmedPassword = providedPassword.trim();

  if (!normalizedUsername || !providedPassword) {
    return {
      reason: 'missing_credentials',
      hasUsername: Boolean(normalizedUsername),
      hasPassword: Boolean(providedPassword),
    };
  }

  const users = getUsers();
  const user = users.find((entry) => entry.username.toLowerCase() === normalizedUsername);

  if (!user) {
    return {
      reason: 'unknown_username',
      attemptedUsername: normalizedUsername,
      configuredUsernames: users.map((entry) => entry.username.toLowerCase()),
      configuredUserCount: users.length,
    };
  }

  const passwordMatch = safeEqual(user.password, trimmedPassword);
  if (!passwordMatch) {
    return {
      reason: 'password_mismatch',
      matchedUserId: user.id,
      attemptedUsername: normalizedUsername,
      providedPasswordLength: providedPassword.length,
      providedPasswordTrimmedLength: trimmedPassword.length,
      expectedPasswordLength: user.password.length,
      lengthMismatch: trimmedPassword.length !== user.password.length,
      hadLeadingOrTrailingWhitespace: providedPassword !== trimmedPassword,
    };
  }

  return { reason: 'ok', matchedUserId: user.id };
}

export function validateCredentials(username, password) {
  if (!username || !password) return null;
  const normalizedUsername = String(username).trim().toLowerCase();
  const normalizedPassword = String(password).trim();
  const user = getUsers().find((entry) => entry.username.toLowerCase() === normalizedUsername);
  if (!user || !safeEqual(user.password, normalizedPassword)) {
    return null;
  }
  return {
    username: user.username,
    displayName: user.displayName,
  };
}

export async function createSessionToken(user) {
  return new SignJWT({ displayName: user.displayName })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.username)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (!payload.sub) return null;
    return {
      username: payload.sub,
      displayName: typeof payload.displayName === 'string' ? payload.displayName : payload.sub,
    };
  } catch {
    return null;
  }
}

function cookieFlags() {
  const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  return secure ? 'HttpOnly; Secure; SameSite=Lax' : 'HttpOnly; SameSite=Lax';
}

export function buildSessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_MAX_AGE}; ${cookieFlags()}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; ${cookieFlags()}`;
}

export function getSessionFromRequest(request) {
  let cookieHeader = '';
  if (typeof request.headers?.get === 'function') {
    cookieHeader = request.headers.get('cookie') || '';
  } else if (request.headers) {
    cookieHeader = request.headers.cookie || request.headers.Cookie || '';
  }
  const match = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function getSessionUser(request) {
  const token = getSessionFromRequest(request);
  return verifySessionToken(token);
}
