#!/usr/bin/env bash
# Ship the current code to zealate.com: build, upload the site to S3, update the API Lambda, and
# clear CloudFront's cache. The one-time setup (bucket, role, Lambda, CloudFront, DNS) is described
# in infra/README.md; this script only updates what already exists.
#
#   ./scripts/deploy-aws.sh          build and deploy
#   ./scripts/deploy-aws.sh --dry    build and show what would be uploaded
set -euo pipefail
cd "$(dirname "$0")/.."

BUCKET=zealate-site-141216314942
FUNCTION=zealate-api
REGION=eu-north-1
DIST_ID=$(cat infra/distribution-id 2>/dev/null || true)
DRY=${1:-}

npm run typecheck
npm test
npm run build

if [[ "$DRY" == "--dry" ]]; then
  aws s3 sync dist/web "s3://$BUCKET/site" --delete --dryrun
  exit 0
fi

# Hashed assets never change, so they cache for a year; the shell must always be fresh.
aws s3 sync dist/web/assets "s3://$BUCKET/site/assets" --delete \
  --cache-control "public, max-age=31536000, immutable"
# Unhashed files (favicon, robots.txt) keep their names across releases: an hour, not a year.
aws s3 sync dist/web "s3://$BUCKET/site" --exclude "assets/*" --exclude index.html \
  --cache-control "public, max-age=3600"
aws s3 cp dist/web/index.html "s3://$BUCKET/site/index.html" \
  --cache-control "no-cache" --content-type "text/html; charset=utf-8"

(cd dist/lambda && rm -f ../lambda.zip && zip -q ../lambda.zip index.mjs)
aws lambda update-function-code --region "$REGION" --function-name "$FUNCTION" \
  --zip-file fileb://dist/lambda.zip --query LastModified --output text
aws lambda wait function-updated --region "$REGION" --function-name "$FUNCTION"

if [[ -n "$DIST_ID" ]]; then
  aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/index.html" "/" "/robots.txt" "/favicon.svg" --query Invalidation.Id --output text
fi
echo "deployed: https://zealate.com"
