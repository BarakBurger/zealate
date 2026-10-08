/**
 * AWS Lambda entry (Function URL / API Gateway HTTP API payload v2). CloudFront sends /api/* here;
 * everything else is the static site in S3. Needs BUCKET and SESSION_SECRET in the environment.
 */
import { handle } from './app.js';
import { s3Storage, type Storage } from './storage.js';

let storage: Storage | null = null;

export const handler = async (event: any) => {
  storage ??= await s3Storage(process.env.BUCKET!);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(event.headers || {})) headers[k.toLowerCase()] = String(v);
  if (event.cookies?.length) headers.cookie = event.cookies.join('; ');
  const body = event.body ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8') : Buffer.alloc(0);
  const out = await handle({
    method: event.requestContext?.http?.method || 'GET',
    path: event.rawPath || '/',
    query: new URLSearchParams(event.rawQueryString || ''),
    headers, body,
  }, { storage, secret: process.env.SESSION_SECRET!, secureCookies: true });
  const { 'set-cookie': cookie, ...rest } = out.headers || {};
  const isBinary = Buffer.isBuffer(out.body);
  return {
    statusCode: out.status,
    headers: rest,
    cookies: cookie ? [cookie] : undefined,
    body: isBinary ? (out.body as Buffer).toString('base64') : (out.body ?? ''),
    isBase64Encoded: isBinary,
  };
};
