/**
 * Accounts are a username and a password, nothing else. There is no email, so there is no
 * password reset: a forgotten password is a lost account, and the sign-up page says so.
 *
 * Passwords are stored only as scrypt hashes with a per-user salt. A session is a signed token in
 * an HttpOnly cookie, so page scripts can never read it.
 */
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export const USERNAME_RULE = /^[a-z0-9_.֐-׿-]{3,24}$/i;
export const MIN_PASSWORD = 8;

export const normalizeUsername = (u: string) => u.trim().toLowerCase();

export const hashPassword = async (password: string) => {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64, SCRYPT);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
};

export const verifyPassword = async (password: string, stored: string) => {
  const [kind, saltB64, hashB64] = stored.split('$');
  if (kind !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, SCRYPT);
  return timingSafeEqual(actual, expected);
};

const SESSION_DAYS = 30;
const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export const signSession = (username: string, secret: string) => {
  const payload = b64url(JSON.stringify({ u: username, exp: Date.now() + SESSION_DAYS * 864e5 }));
  const sig = b64url(createHmac('sha256', secret).update(payload).digest());
  return `${payload}.${sig}`;
};

export const readSession = (token: string | undefined, secret: string): string | null => {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = b64url(createHmac('sha256', secret).update(payload).digest());
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof u === 'string' && typeof exp === 'number' && exp > Date.now() ? u : null;
  } catch { return null; }
};

export const sessionCookie = (token: string, secure: boolean) =>
  `z_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`;

export const clearCookie = (secure: boolean) =>
  `z_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;

export const readCookie = (header: string | undefined, name: string) => {
  for (const part of (header || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
};
