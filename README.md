# Zealate

Write books chapter by chapter, and read them like books. Hebrew (right to left) and English.
Live at zealate.com (once deployed).

- Reader: an open book at trade-paperback proportions (5.5 x 8.5 in), two pages on wide screens,
  page numbers running straight through the book.
- Writing: one sheet per chapter, autosave, chapters in any order, drafts until published.
- Publishing: book public, chapter list public, each chapter public, author name (or pen name) shown or not.
- Export: Word (.doc) and PDF, at book page size.
- Accounts: username and password only. There is no email and no password reset.
- Storage: no database. JSON and image files in S3 on AWS, in ./data locally.

## Run locally

```bash
npm install
npm run dev
```

The site is at http://localhost:5180 and the API at http://localhost:8787 (Vite proxies /api).

## Check

```bash
npm run typecheck
npm test
```

## Deploy (AWS)

`npm run build` produces `dist/web` (static site for S3 + CloudFront) and `dist/lambda/index.mjs`
(the API for Lambda; needs `BUCKET` and `SESSION_SECRET`). CloudFront routes `/api/*` to the Lambda.
