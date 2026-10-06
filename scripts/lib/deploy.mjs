// Pure helpers for the deploy scripts: AWS CLI argument lists and file filters, kept testable.
export const REGION = 'us-east-1';
export const STACK = 'zoteamo';
export const BOOTSTRAP_STACK = 'zoteamo-bootstrap';
export const TRANSLATION_REPO = 'https://github.com/zotero/translation-server.git';

export const bucketName = (accountId) => `zoteamo-deploy-${accountId}`;

export function parseRef(text) {
  const sha = String(text).trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`infra/translation-server.ref must hold a 40-character commit SHA, not "${sha}".`);
  return sha;
}

export function packageArgs(bucket) {
  return ['cloudformation', 'package', '--region', REGION, '--template-file', 'infra/template.yaml',
    '--s3-bucket', bucket, '--output-template-file', 'infra/.build/packaged.yaml'];
}

export function deployArgs({ review }) {
  return ['cloudformation', 'deploy', '--region', REGION, '--template-file', 'infra/.build/packaged.yaml',
    '--stack-name', STACK, '--capabilities', 'CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM', 'CAPABILITY_AUTO_EXPAND',
    '--no-fail-on-empty-changeset', ...(review ? ['--no-execute-changeset'] : [])];
}

export function bootstrapArgs({ email, review }) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? '')) throw new Error('Pass the budget alert address with --email you@example.com.');
  return ['cloudformation', 'deploy', '--region', REGION, '--template-file', 'infra/bootstrap.yaml',
    '--stack-name', BOOTSTRAP_STACK, '--parameter-overrides', `AlertEmail=${email}`,
    '--no-fail-on-empty-changeset', ...(review ? ['--no-execute-changeset'] : [])];
}

export function copyFilter(path) {
  return !/[\\/]\.git([\\/]|$)/.test(path) && !/[\\/]node_modules[\\/]\.bin([\\/]|$)/.test(path);
}
