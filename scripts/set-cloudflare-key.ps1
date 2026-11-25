# Creates an access key for the zoteamo-cloudflare IAM user (personal AWS account, profile zoteamo)
# and stores it as Cloudflare Pages secrets. The secret is never printed.
# Run from the repo root: powershell -ExecutionPolicy Bypass -File scripts\set-cloudflare-key.ps1
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

# The expected account ID stays out of the public repo: set ZOTEAMO_AWS_ACCOUNT_ID, or put the ID
# in the git-ignored file .aws-account-id at the repo root.
$expected = $env:ZOTEAMO_AWS_ACCOUNT_ID
if (-not $expected -and (Test-Path .aws-account-id)) { $expected = (Get-Content .aws-account-id -Raw).Trim() }
if (-not $expected) { throw 'Expected AWS account unknown. Set ZOTEAMO_AWS_ACCOUNT_ID or write the personal account ID to .aws-account-id (git-ignored).' }

$account = aws sts get-caller-identity --profile zoteamo --query Account --output text
if ($account -ne $expected) { throw "Profile zoteamo points at account $account, not $expected. Run: aws login --profile zoteamo" }

$k = aws iam create-access-key --user-name zoteamo-cloudflare --profile zoteamo --output json | ConvertFrom-Json
$k.AccessKey.AccessKeyId | npx wrangler pages secret put AWS_ACCESS_KEY_ID --project-name zoteamo
$k.AccessKey.SecretAccessKey | npx wrangler pages secret put AWS_SECRET_ACCESS_KEY --project-name zoteamo
Remove-Variable k
Write-Host 'Done: AWS key stored in Cloudflare Pages.'
