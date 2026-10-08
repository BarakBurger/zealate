import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { handle, normalizeForSearch, type Res } from './app.js';
import { localStorage } from './storage.js';

const ctx = { storage: localStorage(mkdtempSync(path.join(tmpdir(), 'zealate-'))), secret: 'test', secureCookies: false };

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
  const up = await call('POST', '/auth/signup', { username: 'Noa', password: 'correct horse' });
  assert.equal(up.status, 201);
  assert.ok(up.cookie?.startsWith('z_session='));
  assert.equal((await call('POST', '/auth/signup', { username: 'noa', password: 'another one' })).status, 409);
  assert.equal((await call('POST', '/auth/login', { username: 'noa', password: 'wrong pass' })).status, 401);
  const inn = await call('POST', '/auth/login', { username: 'NOA', password: 'correct horse' });
  assert.equal(inn.status, 200);
  assert.equal((await call('GET', '/auth/me', undefined, inn.cookie)).data.user.display, 'Noa');
});

test('a book is private until made public, and the author stays hidden unless chosen', async () => {
  const { cookie } = await call('POST', '/auth/signup', { username: 'dana', password: 'password123' });
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

  const other = await call('POST', '/auth/signup', { username: 'eve', password: 'password123' });
  assert.equal((await call('PATCH', `/books/${id}`, { title: 'mine now' }, other.cookie)).status, 403);
  assert.equal((await call('GET', `/books/${id}/chapters/${ch.data.chapter.id}`)).data.chapter.body, 'היה היה פעם בית.');
});

test('chapters reorder, and writes need the site header', async () => {
  const { cookie } = await call('POST', '/auth/signup', { username: 'yoni', password: 'password123' });
  const id = (await call('POST', '/books', { title: 'Order' }, cookie)).data.book.id;
  const a = (await call('POST', `/books/${id}/chapters`, { title: 'A' }, cookie)).data.chapter.id;
  const b = (await call('POST', `/books/${id}/chapters`, { title: 'B' }, cookie)).data.chapter.id;
  const r = await call('PUT', `/books/${id}/chapters/order`, { ids: [b, a] }, cookie);
  assert.deepEqual(r.data.book.chapters.map((c: any) => c.title), ['B', 'A']);
  assert.equal((await call('POST', '/books', { title: 'x' }, cookie, { 'x-zealate': '' })).status, 403);
});

test('search ignores Hebrew vowel marks and case', () => {
  assert.equal(normalizeForSearch('שָׁלוֹם  World'), 'שלום world');
});

test('chapter list toggle, drafts, insert anywhere, readable texts', async () => {
  const { cookie } = await call('POST', '/auth/signup', { username: 'maya', password: 'password123' });
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
  const { cookie } = await call('POST', '/auth/signup', { username: 'writer77', password: 'password123' });
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
