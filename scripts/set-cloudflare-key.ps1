# Creates an access key for the zoteamo-cloudflare IAM user (personal AWS account, profile zoteamo)
# and stores it as Cloudflare Pages secrets. The secret is never printed.
# Run from the repo root: powershell -ExecutionPolicy Bypass -File scripts\set-cloudflare-key.ps1
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

$account = aws sts get-caller-identity --profile zoteamo --query Account --output text
if ($account -ne '022741688075') { throw "Profile zoteamo points at account $account, not 022741688075. Run: aws login --profile zoteamo" }

$k = aws iam create-access-key --user-name zoteamo-cloudflare --profile zoteamo --output json | ConvertFrom-Json
$k.AccessKey.AccessKeyId | npx wrangler pages secret put AWS_ACCESS_KEY_ID --project-name zoteamo
$k.AccessKey.SecretAccessKey | npx wrangler pages secret put AWS_SECRET_ACCESS_KEY --project-name zoteamo
Remove-Variable k
Write-Host 'Done: AWS key stored in Cloudflare Pages.'
