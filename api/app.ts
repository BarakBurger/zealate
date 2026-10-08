/**
 * The whole Zealate API as one function: a request in, a response out. The local server and the
 * AWS Lambda handler are both thin adapters around {@link handle}, so the same code runs in both.
 */
import { randomBytes } from 'node:crypto';
import type { Storage } from './storage.js';
import {
  MIN_PASSWORD, USERNAME_RULE, clearCookie, hashPassword, normalizeUsername, readCookie,
  readSession, sessionCookie, signSession, verifyPassword,
} from './auth.js';

export type Req = { method: string; path: string; query: URLSearchParams; headers: Record<string, string | undefined>; body: Buffer };
export type Res = { status: number; headers?: Record<string, string>; body?: string | Buffer };
export type Ctx = { storage: Storage; secret: string; secureCookies: boolean };

type User = { username: string; display: string; passwordHash: string; createdAt: string };
/** isPublic: the chapter's text can be read by anyone (when the book is public). Chapters saved
 *  before this flag existed count as published. */
type ChapterRef = { id: string; title: string; words: number; updatedAt: string; isPublic?: boolean };
type Book = {
  id: string; owner: string; ownerDisplay: string; title: string; description: string;
  isPublic: boolean; authorPublic: boolean; cover: string | null;
  /** Readers see every chapter title, published or not. Off: they see only published chapters. */
  listPublic?: boolean;
  /** The name printed on the book: a real name or a pen name. Empty: the username. */
  authorName?: string;
  chapters: ChapterRef[]; createdAt: string; updatedAt: string;
};
type Chapter = { id: string; title: string; body: string; updatedAt: string };
type PublicEntry = {
  id: string; title: string; description: string; author: string | null; hasCover: boolean;
  chapterTitles: string[]; chapterCount: number; updatedAt: string;
};

const MAX_COVER_BYTES = 4 * 1024 * 1024;
const MAX_CHAPTER_CHARS = 400_000;
const COVER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const json = (status: number, data: unknown, headers: Record<string, string> = {}): Res => ({
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  body: JSON.stringify(data),
});
const fail = (status: number, error: string) => json(status, { error });
const newId = () => randomBytes(9).toString('base64url');
const now = () => new Date().toISOString();
const wordCount = (s: string) => (s.trim().match(/\S+/g) || []).length;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const parseBody = (req: Req): any => {
  if (!req.body.length) return {};
  try { return JSON.parse(req.body.toString('utf8')); } catch { return null; }
};

/** Hebrew without vowel marks, lower case, single spaces: what search compares. */
export const normalizeForSearch = (s: string) =>
  s.normalize('NFKD').replace(/[֑-ׇ̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Failed logins slow down per username: after 5 misses, one try every 30 seconds. In-memory, so
// it resets when a Lambda instance is recycled; it is a speed bump for guessing, not a lock.
const failures = new Map<string, { count: number; until: number }>();

export const handle = async (req: Req, ctx: Ctx): Promise<Res> => {
  try {
    return await route(req, ctx);
  } catch (e) {
    console.error('[zealate] unhandled', req.method, req.path, e);
    return fail(500, 'Something went wrong. Please try again.');
  }
};

const route = async (req: Req, ctx: Ctx): Promise<Res> => {
  const { storage: db } = ctx;
  const me = readSession(readCookie(req.headers.cookie, 'z_session'), ctx.secret);
  const parts = req.path.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const [a, b, c, d] = parts;
  const m = req.method.toUpperCase();

  // A state-changing request must come from our own pages (the cookie is SameSite=Lax already;
  // this also refuses form posts from other sites).
  if (m !== 'GET' && m !== 'HEAD' && req.headers['x-zealate'] !== '1') return fail(403, 'Missing request header.');

  // ---------------------------------------------------------------- auth
  if (a === 'auth') {
    if (b === 'me' && m === 'GET') {
      if (!me) return json(200, { user: null });
      const u = await db.getJson<User>(`users/${me}.json`);
      return json(200, { user: u ? { username: u.username, display: u.display } : null });
    }
    if (b === 'logout' && m === 'POST') return json(200, { ok: true }, { 'set-cookie': clearCookie(ctx.secureCookies) });
    if ((b === 'signup' || b === 'login') && m === 'POST') {
      const body = parseBody(req);
      if (!body) return fail(400, 'Bad request.');
      const display = str(body.username, 24);
      const username = normalizeUsername(display);
      const password = typeof body.password === 'string' ? body.password : '';
      if (b === 'signup') {
        if (!USERNAME_RULE.test(username)) return fail(400, 'Usernames are 3 to 24 letters, digits, dots, dashes or underscores.');
        if (password.length < MIN_PASSWORD) return fail(400, `Passwords need at least ${MIN_PASSWORD} characters.`);
        const user: User = { username, display, passwordHash: await hashPassword(password), createdAt: now() };
        if (!(await db.createJson(`users/${username}.json`, user))) return fail(409, 'That username is taken.');
        await db.putJson(`owners/${username}.json`, { books: [] });
        return json(201, { user: { username, display } }, { 'set-cookie': sessionCookie(signSession(username, ctx.secret), ctx.secureCookies) });
      }
      const f = failures.get(username);
      if (f && f.count >= 5 && f.until > Date.now()) return fail(429, 'Too many attempts. Wait half a minute and try again.');
      const user = USERNAME_RULE.test(username) ? await db.getJson<User>(`users/${username}.json`) : null;
      const ok = user ? await verifyPassword(password, user.passwordHash) : false;
      if (!ok || !user) {
        const count = (f?.count || 0) + 1;
        failures.set(username, { count, until: Date.now() + 30_000 });
        return fail(401, 'Wrong username or password.');
      }
      failures.delete(username);
      return json(200, { user: { username, display: user.display } }, { 'set-cookie': sessionCookie(signSession(username, ctx.secret), ctx.secureCookies) });
    }
    return fail(404, 'Not found.');
  }

  // ---------------------------------------------------------------- public reading & search
  if (a === 'search' && m === 'GET') {
    const q = normalizeForSearch(req.query.get('q') || '');
    const index = (await db.getJson<{ books: PublicEntry[] }>('index/public.json'))?.books || [];
    if (!q) return json(200, { results: index.slice(0, 48) });
    const terms = q.split(' ');
    const scored = index.map(e => {
      const fields: [string, number][] = [[e.title, 5], [e.author || '', 4], [e.description, 2], [e.chapterTitles.join(' '), 1]];
      let score = 0;
      for (const t of terms) {
        let hit = false;
        for (const [text, w] of fields) if (normalizeForSearch(text).includes(t)) { score += w; hit = true; }
        if (!hit) return { e, score: 0 };
      }
      return { e, score };
    }).filter(x => x.score > 0).sort((x, y) => y.score - x.score);
    return json(200, { results: scored.slice(0, 48).map(x => x.e) });
  }

  if (a === 'my' && b === 'books' && m === 'GET') {
    if (!me) return fail(401, 'Please sign in.');
    const ids = (await db.getJson<{ books: string[] }>(`owners/${me}.json`))?.books || [];
    const books = (await Promise.all(ids.map(id => db.getJson<Book>(`books/${id}/meta.json`)))).filter(Boolean) as Book[];
    return json(200, { books: books.map(b => publicShape(b, true)) });
  }

  if (a !== 'books') return fail(404, 'Not found.');

  // POST /books
  if (!b && m === 'POST') {
    if (!me) return fail(401, 'Please sign in.');
    const body = parseBody(req);
    const user = await db.getJson<User>(`users/${me}.json`);
    if (!body || !user) return fail(400, 'Bad request.');
    const book: Book = {
      id: newId(), owner: me, ownerDisplay: user.display, title: str(body.title, 160) || 'Untitled', description: '',
      isPublic: false, authorPublic: false, listPublic: true, cover: null, chapters: [], createdAt: now(), updatedAt: now(),
    };
    await db.putJson(`books/${book.id}/meta.json`, book);
    const owner = (await db.getJson<{ books: string[] }>(`owners/${me}.json`)) || { books: [] };
    await db.putJson(`owners/${me}.json`, { books: [book.id, ...owner.books] });
    return json(201, { book: publicShape(book, true) });
  }

  if (!b) return fail(404, 'Not found.');
  const book = await db.getJson<Book>(`books/${b}/meta.json`);
  if (!book) return fail(404, 'This book does not exist.');
  const isOwner = me === book.owner;
  const canRead = isOwner || book.isPublic;
  if (!canRead) return fail(404, 'This book does not exist.');

  const save = async () => {
    book.updatedAt = now();
    await db.putJson(`books/${book.id}/meta.json`, book);
    await syncIndex(db, book);
  };

  // GET /books/:id
  if (!c && m === 'GET') return json(200, { book: shapeFor(book, isOwner) });

  // PATCH /books/:id
  if (!c && m === 'PATCH') {
    if (!isOwner) return fail(403, 'Only the author can change this book.');
    const body = parseBody(req);
    if (!body) return fail(400, 'Bad request.');
    if (typeof body.title === 'string') book.title = str(body.title, 160) || 'Untitled';
    if (typeof body.description === 'string') book.description = str(body.description, 1200);
    if (typeof body.isPublic === 'boolean') book.isPublic = body.isPublic;
    if (typeof body.authorPublic === 'boolean') book.authorPublic = body.authorPublic;
    if (typeof body.listPublic === 'boolean') book.listPublic = body.listPublic;
    if (typeof body.authorName === 'string') book.authorName = str(body.authorName, 80);
    await save();
    return json(200, { book: shapeFor(book, true) });
  }

  // DELETE /books/:id
  if (!c && m === 'DELETE') {
    if (!isOwner) return fail(403, 'Only the author can delete this book.');
    book.isPublic = false;
    await syncIndex(db, book);
    await db.deletePrefix(`books/${book.id}/`);
    await db.deletePrefix(`covers/${book.id}/`);
    const owner = (await db.getJson<{ books: string[] }>(`owners/${me}.json`)) || { books: [] };
    await db.putJson(`owners/${me}.json`, { books: owner.books.filter(id => id !== book.id) });
    return json(200, { ok: true });
  }

  // cover
  if (c === 'cover') {
    if (m === 'GET') {
      if (!book.cover) return fail(404, 'No cover.');
      const blob = await db.getBlob(book.cover);
      if (!blob) return fail(404, 'No cover.');
      return { status: 200, headers: { 'content-type': blob.contentType, 'cache-control': 'public, max-age=300' }, body: blob.body };
    }
    if (m === 'PUT') {
      if (!isOwner) return fail(403, 'Only the author can change the cover.');
      const type = (req.headers['content-type'] || '').split(';')[0].trim();
      if (!COVER_TYPES.has(type)) return fail(415, 'Covers can be JPG, PNG or WebP.');
      if (!req.body.length || req.body.length > MAX_COVER_BYTES) return fail(413, 'Covers can be up to 4 MB.');
      if (book.cover) await db.delete(book.cover);
      book.cover = `covers/${book.id}/${newId()}`;
      await db.putBlob(book.cover, { body: req.body, contentType: type });
      await save();
      return json(200, { book: shapeFor(book, true) });
    }
    if (m === 'DELETE') {
      if (!isOwner) return fail(403, 'Only the author can change the cover.');
      if (book.cover) await db.delete(book.cover);
      book.cover = null;
      await save();
      return json(200, { book: shapeFor(book, true) });
    }
  }

  if (c !== 'chapters') return fail(404, 'Not found.');

  // POST /books/:id/chapters
  if (!d && m === 'POST') {
    if (!isOwner) return fail(403, 'Only the author can add chapters.');
    const body = parseBody(req) || {};
    // Chapters can be written in any order: a new one goes at the end, at the start, or right
    // after a chosen chapter, and the order can be changed later.
    const after = typeof body.after === 'string' ? book.chapters.findIndex(c => c.id === body.after) : -2;
    const at = body.position === 'start' ? 0 : after >= 0 ? after + 1 : book.chapters.length;
    const ch: Chapter = { id: newId(), title: str(body.title, 160) || `Chapter ${at + 1}`, body: '', updatedAt: now() };
    await db.putJson(`books/${book.id}/chapters/${ch.id}.json`, ch);
    book.chapters.splice(at, 0, { id: ch.id, title: ch.title, words: 0, updatedAt: ch.updatedAt, isPublic: false });
    await save();
    return json(201, { chapter: ch, book: shapeFor(book, true) });
  }

  // PUT /books/:id/chapters/order
  if (d === 'order' && m === 'PUT') {
    if (!isOwner) return fail(403, 'Only the author can reorder chapters.');
    const ids: unknown = parseBody(req)?.ids;
    if (!Array.isArray(ids) || ids.length !== book.chapters.length || new Set(ids).size !== ids.length) return fail(400, 'Send every chapter id once.');
    const byId = new Map(book.chapters.map(ch => [ch.id, ch]));
    if (!ids.every(id => byId.has(id as string))) return fail(400, 'Unknown chapter.');
    book.chapters = ids.map(id => byId.get(id as string)!);
    await save();
    return json(200, { book: shapeFor(book, true) });
  }

  // GET /books/:id/chapters: the text of every chapter this visitor may read, in order. The
  // reader lays them out off-screen to number pages straight through the book.
  if (!d && m === 'GET') {
    const readable = book.chapters.filter(ch => isOwner || chapterPublic(ch));
    const texts = await Promise.all(readable.map(ch => db.getJson<Chapter>(`books/${book.id}/chapters/${ch.id}.json`)));
    return json(200, { chapters: texts.filter(Boolean) });
  }

  if (!d) return fail(404, 'Not found.');
  const ref = book.chapters.find(ch => ch.id === d);
  if (!ref) return fail(404, 'This chapter does not exist.');
  if (!isOwner && !chapterPublic(ref)) return fail(404, 'This chapter has not been published.');

  if (m === 'GET') {
    const ch = await db.getJson<Chapter>(`books/${book.id}/chapters/${d}.json`);
    return ch ? json(200, { chapter: ch }) : fail(404, 'This chapter does not exist.');
  }
  if (m === 'PUT') {
    if (!isOwner) return fail(403, 'Only the author can edit chapters.');
    const body = parseBody(req);
    if (!body) return fail(400, 'Bad request.');
    const ch = (await db.getJson<Chapter>(`books/${book.id}/chapters/${d}.json`)) || { id: d, title: ref.title, body: '', updatedAt: now() };
    if (typeof body.title === 'string') ch.title = str(body.title, 160) || ref.title;
    if (typeof body.isPublic === 'boolean') ref.isPublic = body.isPublic;
    if (typeof body.body === 'string') {
      if (body.body.length > MAX_CHAPTER_CHARS) return fail(413, 'This chapter is too long to save. Split it into two.');
      ch.body = body.body;
    }
    ch.updatedAt = now();
    await db.putJson(`books/${book.id}/chapters/${d}.json`, ch);
    Object.assign(ref, { title: ch.title, words: wordCount(ch.body), updatedAt: ch.updatedAt });
    await save();
    return json(200, { chapter: ch, book: shapeFor(book, true) });
  }
  if (m === 'DELETE') {
    if (!isOwner) return fail(403, 'Only the author can delete chapters.');
    await db.delete(`books/${book.id}/chapters/${d}.json`);
    book.chapters = book.chapters.filter(ch => ch.id !== d);
    await save();
    return json(200, { book: shapeFor(book, true) });
  }
  return fail(405, 'Method not allowed.');
};

const chapterPublic = (c: ChapterRef) => c.isPublic !== false;
const listPublic = (b: Book) => b.listPublic !== false;
const authorOf = (b: Book) => b.authorName?.trim() || b.ownerDisplay;

/** The chapters a reader is shown: all titles when the list is public, otherwise only published ones. */
const visibleChapters = (b: Book) =>
  b.chapters.filter(c => listPublic(b) || chapterPublic(c)).map(c => ({ ...c, isPublic: chapterPublic(c) }));

/** What a reader may see. The author's name appears only when the author made it public. */
const publicShape = (b: Book, isOwner = false) => ({
  id: b.id, title: b.title, description: b.description, isPublic: b.isPublic, authorPublic: b.authorPublic,
  listPublic: listPublic(b), author: b.authorPublic ? authorOf(b) : null, hasCover: !!b.cover,
  chapters: isOwner ? b.chapters.map(c => ({ ...c, isPublic: chapterPublic(c) })) : visibleChapters(b),
  updatedAt: b.updatedAt, createdAt: b.createdAt,
});
const shapeFor = (b: Book, isOwner: boolean) => ({
  ...publicShape(b, isOwner), isOwner,
  ownerDisplay: isOwner ? b.ownerDisplay : undefined, authorName: isOwner ? b.authorName || '' : undefined,
});

/** Keeps index/public.json in step with one book: in it when public, out of it otherwise. */
const syncIndex = async (db: Storage, b: Book) => {
  const index = (await db.getJson<{ books: PublicEntry[] }>('index/public.json')) || { books: [] };
  const rest = index.books.filter(e => e.id !== b.id);
  const books = b.isPublic
    ? [{
        id: b.id, title: b.title, description: b.description, author: b.authorPublic ? authorOf(b) : null,
        hasCover: !!b.cover, chapterTitles: visibleChapters(b).map(ch => ch.title),
        chapterCount: b.chapters.filter(chapterPublic).length, updatedAt: b.updatedAt,
      }, ...rest]
    : rest;
  if (b.isPublic || rest.length !== index.books.length) await db.putJson('index/public.json', { books });
};
