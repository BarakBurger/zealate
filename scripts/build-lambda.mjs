// Bundles the API into one file for AWS Lambda (dist/lambda/index.mjs). The AWS SDK v3 ships
// with the Lambda Node runtime, so it stays external.
import { build } from 'esbuild';
await build({
  entryPoints: ['api/lambda.ts'], bundle: true, platform: 'node', target: 'node20', format: 'esm',
  outfile: 'dist/lambda/index.mjs', external: ['@aws-sdk/*'],
});
console.log('lambda bundle: dist/lambda/index.mjs');
