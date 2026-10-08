# zealate.com on AWS

Everything below was created once by hand with the AWS CLI. Day-to-day code updates go out with
`./scripts/deploy-aws.sh`, which only touches the site files, the Lambda code and the cache.

| Piece | Name | Where |
|---|---|---|
| Account | 141216314942 (Builder ID "project" account) | |
| Storage | S3 bucket `zealate-site-141216314942` | **eu-north-1** |
| Site files | `site/` prefix in that bucket, read only by CloudFront | |
| Data | `users/ owners/ books/ covers/ index/` prefixes, read/written only by the Lambda | |
| API | Lambda `zealate-api` (Node 20, arm64), function URL, role `zealate-api-role` | **eu-north-1** |
| CDN | CloudFront `E1AZPDG7X4R8OF` (id also in `infra/distribution-id`) | global |
| Routing | CloudFront function `zealate-viewer-request` (`infra/viewer-request.js`) | global |
| Certificate | ACM, `zealate.com` + `www.zealate.com`, DNS-validated, auto-renews | **us-east-1** (CloudFront requires it) |
| DNS | Route 53 hosted zone `Z008583420OIIY3CJQNJN`; GoDaddy points its nameservers here | global |

## Why eu-north-1

The account is in AWS's simplified "project" experience, which allows one Region only. S3 and
Lambda calls in us-east-1 fail with *"explicit deny in a service control policy"*, which looks like
a missing permission but is the Region lock. Everything regional lives in eu-north-1 (Stockholm);
global services (CloudFront, Route 53, ACM for CloudFront in us-east-1) are unaffected.

## How a request flows

- `https://zealate.com/...` → CloudFront → the viewer-request function sends `www.` to the bare
  domain and rewrites app routes (no file extension) to `/index.html` → S3 `site/` via Origin
  Access Control. The bucket is private; its policy lets only this distribution read `site/*`.
- `https://zealate.com/api/...` → CloudFront (no caching, all viewer headers except Host) → the
  Lambda function URL, with an `x-origin-secret` header. The Lambda refuses any request without it,
  so the public function URL is useless on its own.

## Secrets

`SESSION_SECRET` (signs login cookies) and `ORIGIN_SECRET` live only in the Lambda's environment
(and the origin header in the CloudFront config). Rotating `SESSION_SECRET` signs everyone out.
