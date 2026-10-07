// Guardrails for the $0 rule (spec section 6) and the Lambda shape (spec section 2). Text checks, because the
// templates use CloudFormation tags that plain YAML parsers reject.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync('infra/template.yaml', 'utf8');
const boot = readFileSync('infra/bootstrap.yaml', 'utf8');
const count = (text, re) => (text.match(re) ?? []).length;

test('no API Gateway or anything billed by the hour', () => {
  const banned = [/AWS::ApiGateway/, /Type:\s*(Api|HttpApi)\b/, /NatGateway/, /ElasticLoadBalancing/, /AWS::ECR::/, /AWS::EC2::Instance/, /AWS::RDS::/, /ProvisionedConcurrency/];
  for (const text of [main, boot]) for (const re of banned) assert.doesNotMatch(text, re);
});

test('both functions sit behind IAM-auth Function URLs with reserved concurrency 2 by default', () => {
  assert.equal(count(main, /^\s+AuthType: AWS_IAM/gm), 2);
  assert.match(main, /ReservedConcurrency:\s*\n\s+Type: Number\s*\n\s+Default: 2\b/);
  assert.equal(count(main, /ReservedConcurrentExecutions: !If \[ReserveConcurrency, !Ref ReservedConcurrency, !Ref AWS::NoValue\]/g), 2);
});

test('logs are kept for 7 days', () => {
  assert.equal(count(main, /RetentionInDays: 7\b/g), 2);
});

test('function settings match the spec', () => {
  assert.match(main, /FunctionName: zoteamo-translation[\s\S]*?Handler: src\/lambda\.handler[\s\S]*?MemorySize: 2048[\s\S]*?Timeout: 30\b/);
  assert.match(main, /FunctionName: zoteamo-format[\s\S]*?MemorySize: 1769[\s\S]*?Timeout: 20\b/);
  assert.equal(count(main, /Runtime: nodejs24\.x/g), 2);
  assert.match(main, /NODE_OPTIONS: '--experimental-require-module'/);
});

test('the Cloudflare user can only invoke the two functions through their URLs', () => {
  assert.match(main, /UserName: zoteamo-cloudflare/);
  assert.match(main, /Action: lambda:InvokeFunctionUrl/);
  assert.match(main, /Action: lambda:InvokeFunction\r?\n[\s\S]*?lambda:InvokedViaFunctionUrl: 'true'/);
  assert.doesNotMatch(main, /Action:\s*['"]?\*|lambda:\*/);
});

test('deploy artifacts expire after a day and the bucket is not versioned', () => {
  assert.match(boot, /ExpirationInDays: 1\b/);
  assert.doesNotMatch(boot, /VersioningConfiguration/);
});

test('a $0.01 budget emails the user', () => {
  assert.match(boot, /Amount: 0\.01/);
  assert.match(boot, /SubscriptionType: EMAIL/);
});
