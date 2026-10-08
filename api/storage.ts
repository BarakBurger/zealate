/**
 * Everything Zealate keeps lives here, as small JSON files and image files. There is no database:
 * on AWS the files sit in one S3 bucket, and on a developer's machine in ./data.
 *
 * Layout:
 *   users/<username>.json           one account (password stored only as a scrypt hash)
 *   owners/<username>.json          the ids of that user's books, newest first
 *   books/<id>/meta.json            title, settings and the ordered chapter list
 *   books/<id>/chapters/<cid>.json  one chapter's text
 *   covers/<id>/<name>              uploaded cover images
 *   index/public.json               every public book, kept small for search
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

export type Blob = { body: Buffer; contentType: string };

export interface Storage {
  getJson<T>(key: string): Promise<T | null>;
  putJson(key: string, value: unknown): Promise<void>;
  /** Writes only if nothing is there yet. Returns false when the key already exists. */
  createJson(key: string, value: unknown): Promise<boolean>;
  getBlob(key: string): Promise<Blob | null>;
  putBlob(key: string, blob: Blob): Promise<void>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
}

const safeKey = (key: string) => {
  if (!/^[a-z0-9][a-z0-9/_.-]*$/i.test(key) || key.includes('..')) throw new Error(`Bad storage key: ${key}`);
  return key;
};

/** Files on disk, for running locally. Content types live in a sidecar file next to each blob. */
export const localStorage = (root: string): Storage => {
  const file = (key: string) => path.join(root, safeKey(key));
  const ensureDir = (p: string) => fs.mkdir(path.dirname(p), { recursive: true });
  const readOrNull = async (p: string) => {
    try { return await fs.readFile(p); } catch (e: any) { if (e.code === 'ENOENT') return null; throw e; }
  };
  return {
    async getJson<T>(key: string) {
      const buf = await readOrNull(file(key));
      return buf ? (JSON.parse(buf.toString('utf8')) as T) : null;
    },
    async putJson(key, value) {
      const p = file(key); await ensureDir(p);
      const tmp = `${p}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(value));
      await fs.rename(tmp, p);
    },
    async createJson(key, value) {
      const p = file(key); await ensureDir(p);
      try { await fs.writeFile(p, JSON.stringify(value), { flag: 'wx' }); return true; }
      catch (e: any) { if (e.code === 'EEXIST') return false; throw e; }
    },
    async getBlob(key) {
      const body = await readOrNull(file(key));
      if (!body) return null;
      const type = await readOrNull(`${file(key)}.type`);
      return { body, contentType: type ? type.toString('utf8') : 'application/octet-stream' };
    },
    async putBlob(key, blob) {
      const p = file(key); await ensureDir(p);
      await fs.writeFile(p, blob.body);
      await fs.writeFile(`${p}.type`, blob.contentType);
    },
    async delete(key) {
      await fs.rm(file(key), { force: true });
      await fs.rm(`${file(key)}.type`, { force: true });
    },
    async deletePrefix(prefix) {
      await fs.rm(path.join(root, safeKey(prefix)), { recursive: true, force: true });
    },
  };
};

/** One S3 bucket. Loaded lazily so local development never needs the AWS SDK at runtime. */
export const s3Storage = async (bucket: string): Promise<Storage> => {
  const s3mod = await import('@aws-sdk/client-s3');
  const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = s3mod;
  const client = new S3Client({});
  const get = async (key: string) => {
    try {
      const r = await client.send(new GetObjectCommand({ Bucket: bucket, Key: safeKey(key) }));
      const body = Buffer.from(await r.Body!.transformToByteArray());
      return { body, contentType: r.ContentType || 'application/octet-stream' };
    } catch (e: any) {
      if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) return null;
      throw e;
    }
  };
  return {
    async getJson<T>(key: string) {
      const r = await get(key);
      return r ? (JSON.parse(r.body.toString('utf8')) as T) : null;
    },
    async putJson(key, value) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: safeKey(key), Body: JSON.stringify(value), ContentType: 'application/json' }));
    },
    async createJson(key, value) {
      try {
        await client.send(new PutObjectCommand({ Bucket: bucket, Key: safeKey(key), Body: JSON.stringify(value), ContentType: 'application/json', IfNoneMatch: '*' }));
        return true;
      } catch (e: any) {
        if (e?.$metadata?.httpStatusCode === 412) return false;
        throw e;
      }
    },
    getBlob: get,
    async putBlob(key, blob) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: safeKey(key), Body: blob.body, ContentType: blob.contentType }));
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: safeKey(key) }));
    },
    async deletePrefix(prefix) {
      let token: string | undefined;
      do {
        const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: safeKey(prefix), ContinuationToken: token }));
        const keys = (page.Contents || []).map(o => ({ Key: o.Key! }));
        if (keys.length) await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys } }));
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
    },
  };
};
