export type ChapterRef = { id: string; title: string; words: number; updatedAt: string; isPublic: boolean };
export type Book = {
  id: string; title: string; description: string; isPublic: boolean; authorPublic: boolean; listPublic: boolean;
  author: string | null; hasCover: boolean; chapters: ChapterRef[]; updatedAt: string; createdAt: string;
  isOwner?: boolean; ownerDisplay?: string; authorName?: string;
};
export type Chapter = { id: string; title: string; body: string; updatedAt: string };
export type SearchHit = {
  id: string; title: string; description: string; author: string | null; hasCover: boolean;
  chapterTitles: string[]; chapterCount: number; updatedAt: string;
};
export type User = { username: string; display: string; email: string | null; emailVerified: boolean };

export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }

export const api = async <T = any>(path: string, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers);
  headers.set('x-zealate', '1');
  if (init.body && !(init.body instanceof Blob) && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const res = await fetch(`/api${path}`, { ...init, headers, credentials: 'same-origin' });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new ApiError(data?.error || res.statusText, res.status);
  return data as T;
};

/** Cache-busted by the book's last change, so a new cover shows at once and an old one caches. */
export const coverUrl = (b: { id: string; updatedAt: string }) => `/api/books/${b.id}/cover?v=${encodeURIComponent(b.updatedAt)}`;
