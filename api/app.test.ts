import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { handle, normalizeForSearch, type Res } from './app.js';
import { localStorage } from './storage.js';

const outbox: { to: string; subject: string; text: string }[] = [];
const ctx = {
  storage: localStorage(mkdtempSync(path.join(tmpdir(), 'zealate-'))), secret: 'test', secureCookies: false,
  site: 'https://test', mailer: async (m: { to: string; subject: string; text: string; html: string }) => { outbox.push(m); },
};
const linkFor = (to: string, kind: 'verify' | 'reset') => {
  const m = [...outbox].reverse().find(x => x.to === to && x.text.includes(`/${kind}?token=`));
  return m?.text.match(/token=([A-Za-z0-9_-]+)/)?.[1];
};
/** Sign up with an email and confirm it, as a writer who wants to publish would. */
const verifiedUser = async (username: string) => {
  const email = `${username}@example.com`;
  const up = await call('POST', '/auth/signup', { username, password: 'password123', email });
  await call('POST', '/auth/verify', { token: linkFor(email, 'verify') });
  return up;
};

const call = async (method: string, p: string, body?: unknown, cookie?: string, extra: Record<string, string> = {}) => {
  const [pathname, qs] = p.split('?');
  const res: Res = await handle({
    method, path: `/api${pathname}`, query: new URLSearchParams(qs || ''),
    headers: { 'x-zealate': '1', cookie, 'content-type': 'application/json', ...extra },
    body: body instanceof Buffer ? body : Buffer.from(body === undefined ? '' : JSON.stringify(body)),
  }, ctx);
  const text = Buffer.isBuffer(res.body) ? '' : res.body || '';
  return { status: res.status, data: text ? JSON.parse(text) : null, cookie: res.headers?.['set-cookie']?.split(';')[0] };
};

test('accounts: sign up, duplicate, wrong password, sign in', async () => {
  const up = await call('POST', '/auth/signup', { username: 'Noa', password: 'correct horse', email: 'noa@example.com' });
  assert.equal(up.status, 201);
  assert.ok(up.cookie?.startsWith('z_session='));
  assert.equal((await call('POST', '/auth/signup', { username: 'noa', password: 'another one', email: 'noa2@example.com' })).status, 409);
  assert.equal((await call('POST', '/auth/login', { username: 'noa', password: 'wrong pass' })).status, 401);
  const inn = await call('POST', '/auth/login', { username: 'NOA', password: 'correct horse' });
  assert.equal(inn.status, 200);
  assert.equal((await call('GET', '/auth/me', undefined, inn.cookie)).data.user.display, 'Noa');
});

test('a book is private until made public, and the author stays hidden unless chosen', async () => {
  const { cookie } = await verifiedUser('dana');
  const { data } = await call('POST', '/books', { title: 'הבית ברחוב הרצל' }, cookie);
  const id = data.book.id;
  const ch = await call('POST', `/books/${id}/chapters`, { title: 'פרק ראשון' }, cookie);
  await call('PUT', `/books/${id}/chapters/${ch.data.chapter.id}`, { body: 'היה היה פעם בית.' }, cookie);

  assert.equal((await call('GET', `/books/${id}`)).status, 404, 'private book is invisible to others');
  assert.equal((await call('GET', '/search?q=הרצל')).data.results.length, 0);

  await call('PATCH', `/books/${id}`, { isPublic: true }, cookie);
  assert.equal((await call('GET', `/books/${id}/chapters/${ch.data.chapter.id}`)).status, 404, 'a new chapter is a draft');
  await call('PUT', `/books/${id}/chapters/${ch.data.chapter.id}`, { isPublic: true }, cookie);
  const pub = await call('GET', `/books/${id}`);
  assert.equal(pub.status, 200);
  assert.equal(pub.data.book.author, null, 'author hidden by default');
  assert.equal((await call('GET', `/search?q=dana`)).data.results.length, 0, 'hidden author is not searchable');

  await call('PATCH', `/books/${id}`, { authorPublic: true }, cookie);
  assert.equal((await call('GET', `/books/${id}`)).data.book.author, 'dana');
  assert.equal((await call('GET', `/search?q=dana`)).data.results.length, 1);
  assert.equal((await call('GET', `/search?q=ראשון`)).data.results.length, 1, 'chapter titles are searchable');

  const other = await call('POST', '/auth/signup', { username: 'eve', password: 'password123', email: 'eve@example.com' });
  assert.equal((await call('PATCH', `/books/${id}`, { title: 'mine now' }, other.cookie)).status, 403);
  assert.equal((await call('GET', `/books/${id}/chapters/${ch.data.chapter.id}`)).data.chapter.body, 'היה היה פעם בית.');
});

test('chapters reorder, and writes need the site header', async () => {
  const { cookie } = await call('POST', '/auth/signup', { username: 'yoni', password: 'password123', email: 'yoni@example.com' });
  const id = (await call('POST', '/books', { title: 'Order' }, cookie)).data.book.id;
  const a = (await call('POST', `/books/${id}/chapters`, { title: 'A' }, cookie)).data.chapter.id;
  const b = (await call('POST', `/books/${id}/chapters`, { title: 'B' }, cookie)).data.chapter.id;
  const r = await call('PUT', `/books/${id}/chapters/order`, { ids: [b, a] }, cookie);
  assert.deepEqual(r.data.book.chapters.map((c: any) => c.title), ['B', 'A']);
  assert.equal((await call('POST', '/books', { title: 'x' }, cookie, { 'x-zealate': '' })).status, 403);
});

test('search ignores Hebrew and Arabic vowel marks and case', () => {
  assert.equal(normalizeForSearch('שָׁלוֹם  World'), 'שלום world');
  assert.equal(normalizeForSearch('كِتَابٌ'), 'كتاب');
});

test('the sitemap lists public books and published chapters only', async () => {
  const { cookie } = await verifiedUser('mapper');
  const id = (await call('POST', '/books', { title: 'Mapped' }, cookie)).data.book.id;
  const pub = (await call('POST', `/books/${id}/chapters`, { title: 'Out' }, cookie)).data.chapter.id;
  const draft = (await call('POST', `/books/${id}/chapters`, { title: 'Not yet' }, cookie)).data.chapter.id;
  await call('PUT', `/books/${id}/chapters/${pub}`, { isPublic: true }, cookie);
  await call('PATCH', `/books/${id}`, { isPublic: true }, cookie);
  const res = await handle({ method: 'GET', path: '/api/sitemap.xml', query: new URLSearchParams(), headers: {}, body: Buffer.alloc(0) }, ctx);
  const xml = String(res.body);
  assert.ok(xml.includes(`/b/${id}</loc>`) && xml.includes(`/read/${pub}`));
  assert.ok(!xml.includes(draft), 'drafts stay out');
});

test('chapter list toggle, drafts, insert anywhere, readable texts', async () => {
  const { cookie } = await verifiedUser('maya');
  const id = (await call('POST', '/books', { title: 'Out of order' }, cookie)).data.book.id;
  const five = (await call('POST', `/books/${id}/chapters`, { title: 'Five' }, cookie)).data.chapter.id;
  const one = (await call('POST', `/books/${id}/chapters`, { title: 'One', position: 'start' }, cookie)).data.chapter.id;
  const three = (await call('POST', `/books/${id}/chapters`, { title: 'Three', after: one }, cookie)).data.chapter.id;
  const order = (await call('GET', `/books/${id}`, undefined, cookie)).data.book.chapters.map((c: any) => c.title);
  assert.deepEqual(order, ['One', 'Three', 'Five']);

  await call('PATCH', `/books/${id}`, { isPublic: true }, cookie);
  await call('PUT', `/books/${id}/chapters/${one}`, { body: 'first text', isPublic: true }, cookie);
  await call('PUT', `/books/${id}/chapters/${five}`, { body: 'secret draft' }, cookie);

  let pub = (await call('GET', `/books/${id}`)).data.book;
  assert.deepEqual(pub.chapters.map((c: any) => [c.title, c.isPublic]), [['One', true], ['Three', false], ['Five', false]], 'list public: all titles, drafts marked');
  await call('PATCH', `/books/${id}`, { listPublic: false }, cookie);
  pub = (await call('GET', `/books/${id}`)).data.book;
  assert.deepEqual(pub.chapters.map((c: any) => c.title), ['One'], 'list private: only published chapters');
  assert.equal((await call('GET', `/search?q=five`)).data.results.length, 0, 'hidden titles are not searchable');

  const texts = (await call('GET', `/books/${id}/chapters`)).data.chapters.map((c: any) => c.body);
  assert.deepEqual(texts, ['first text'], 'readers get only published text');
  assert.equal((await call('GET', `/books/${id}/chapters`, undefined, cookie)).data.chapters.length, 3, 'the author gets every chapter');
  assert.equal((await call('GET', `/books/${id}/chapters/${three}`)).status, 404);
});

test('the author name printed on the book can be a pen name', async () => {
  const { cookie } = await verifiedUser('writer77');
  const id = (await call('POST', '/books', { title: 'Pen' }, cookie)).data.book.id;
  await call('PATCH', `/books/${id}`, { isPublic: true, authorName: 'עמוס כהן' }, cookie);
  assert.equal((await call('GET', `/books/${id}`)).data.book.author, null, 'still hidden until shown');
  await call('PATCH', `/books/${id}`, { authorPublic: true }, cookie);
  assert.equal((await call('GET', `/books/${id}`)).data.book.author, 'עמוס כהן');
  assert.equal((await call('GET', `/search?q=עמוס`)).data.results.length, 1);
  assert.equal((await call('GET', `/search?q=writer77`)).data.results.length, 0, 'the username is not exposed');
  await call('PATCH', `/books/${id}`, { authorName: '' }, cookie);
  assert.equal((await call('GET', `/books/${id}`)).data.book.author, 'writer77', 'empty falls back to the username');
});

test('signup needs an email; publishing needs it confirmed', async () => {
  assert.equal((await call('POST', '/auth/signup', { username: 'noemail', password: 'password123' })).status, 400);
  const up = await call('POST', '/auth/signup', { username: 'gil', password: 'password123', email: 'Gil@Example.com', lang: 'he' });
  assert.equal(up.data.user.emailVerified, false);
  assert.ok(outbox.some(m => m.to === 'gil@example.com' && m.subject.includes('זילייט')), 'verification mail in the chosen language');
  const id = (await call('POST', '/books', { title: 'Gated' }, up.cookie)).data.book.id;
  const blocked = await call('PATCH', `/books/${id}`, { isPublic: true }, up.cookie);
  assert.equal(blocked.status, 403);
  assert.equal(blocked.data.code, 'verify_email');
  const token = linkFor('gil@example.com', 'verify');
  assert.equal((await call('POST', '/auth/verify', { token })).data.user.emailVerified, true);
  assert.equal((await call('POST', '/auth/verify', { token })).status, 400, 'a link works once');
  assert.equal((await call('PATCH', `/books/${id}`, { isPublic: true }, up.cookie)).status, 200);
  assert.equal((await call('POST', '/auth/signup', { username: 'gil2', password: 'password123', email: 'gil@example.com' })).status, 409, 'one account per address');
});

test('password reset: same answer for everyone, link works once', async () => {
  await verifiedUser('rina');
  const before = outbox.length;
  assert.equal((await call('POST', '/auth/forgot', { who: 'nobody-here' })).status, 200, 'no hint that the account is missing');
  assert.equal(outbox.length, before);
  await call('POST', '/auth/forgot', { who: 'RINA@example.com' });
  const token = linkFor('rina@example.com', 'reset');
  assert.ok(token);
  assert.equal((await call('POST', '/auth/reset', { token, password: 'short' })).status, 400);
  const ok = await call('POST', '/auth/reset', { token: linkFor('rina@example.com', 'reset'), password: 'a brand new one' });
  assert.equal(ok.status === 200 || ok.status === 400, true);
  await call('POST', '/auth/forgot', { who: 'rina' });
  const fresh = linkFor('rina@example.com', 'reset');
  const done = await call('POST', '/auth/reset', { token: fresh, password: 'a brand new one' });
  assert.equal(done.status, 200);
  assert.equal((await call('POST', '/auth/reset', { token: fresh, password: 'another new one' })).status, 400, 'used once');
  assert.equal((await call('POST', '/auth/login', { username: 'rina', password: 'a brand new one' })).status, 200);
});

test('no reset link to an address nobody confirmed', async () => {
  await call('POST', '/auth/signup', { username: 'unconf', password: 'password123', email: 'unconf@example.com' });
  await call('POST', '/auth/forgot', { who: 'unconf' });
  assert.equal(linkFor('unconf@example.com', 'reset'), undefined);
});

test('change email needs the password and starts unconfirmed; delete removes everything', async () => {
  const { cookie } = await verifiedUser('tal');
  assert.equal((await call('PUT', '/auth/email', { email: 'tal2@example.com', password: 'wrong pass' }, cookie)).status, 401);
  const changed = await call('PUT', '/auth/email', { email: 'tal2@example.com', password: 'password123' }, cookie);
  assert.equal(changed.data.user.email, 'tal2@example.com');
  assert.equal(changed.data.user.emailVerified, false);
  const id = (await call('POST', '/books', { title: 'Gone soon' }, cookie)).data.book.id;
  assert.equal((await call('DELETE', '/auth/account', { password: 'wrong pass' }, cookie)).status, 401);
  assert.equal((await call('DELETE', '/auth/account', { password: 'password123' }, cookie)).status, 200);
  assert.equal((await call('GET', `/books/${id}`, undefined, cookie)).status, 404);
  assert.equal((await call('POST', '/auth/login', { username: 'tal', password: 'password123' })).status, 401);
  const again = await call('POST', '/auth/signup', { username: 'tal', password: 'password123', email: 'tal2@example.com' });
  assert.equal(again.status, 201, 'the username and the address are free again');
});

test('without a mailer, publishing does not wait for a confirmation that could never arrive', async () => {
  const quiet = { ...ctx, mailer: undefined };
  const go = async (method: string, p: string, body?: unknown, cookie?: string) => {
    const r = await handle({ method, path: `/api${p}`, query: new URLSearchParams(), headers: { 'x-zealate': '1', cookie, 'content-type': 'application/json' }, body: Buffer.from(body === undefined ? '' : JSON.stringify(body)) }, quiet);
    return { status: r.status, data: JSON.parse(String(r.body || '{}')), cookie: r.headers?.['set-cookie']?.split(';')[0] };
  };
  const up = await go('POST', '/auth/signup', { username: 'nomail', password: 'password123', email: 'nomail@example.com' });
  assert.equal((await go('GET', '/auth/me', undefined, up.cookie)).data.mail, false);
  const id = (await go('POST', '/books', { title: 'Open' }, up.cookie)).data.book.id;
  assert.equal((await go('PATCH', `/books/${id}`, { isPublic: true }, up.cookie)).status, 200);
});
