#Requires -Version 5.1
<#
.SYNOPSIS
  Full PostgreSQL logical copy: staging database -> production database (DESTRUCTIVE on target).

.DESCRIPTION
  Uses pg_dump (custom format) + pg_restore --clean so all tables/data (teams, divisions,
  pools, games, brackets, users linked rows, _prisma_migrations, etc.) match staging.

  Prerequisites:
  - PostgreSQL client tools installed (pg_dump, pg_restore) and on PATH.
  - Neon: use direct connection strings, not the "-pooler" / transaction pooler host, for both URLs.

  Set env vars in this shell before running:
    $env:STAGING_DATABASE_URL = 'postgresql://...'
    $env:PRODUCTION_DATABASE_URL = 'postgresql://...'

  Safer alternative (Neon): clone/reset the production branch from the staging branch in the Neon console.
#>
param(
  [string]$SourceUrl = $env:STAGING_DATABASE_URL,
  [string]$TargetUrl = $env:PRODUCTION_DATABASE_URL
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $SourceUrl -or -not $TargetUrl) {
  Write-Host @"
Set both URLs in this PowerShell session, then re-run:

  `$env:STAGING_DATABASE_URL     = 'postgresql://...'
  `$env:PRODUCTION_DATABASE_URL = 'postgresql://...'

Use Neon direct (non-pooler) URLs for dump/restore.
"@
  exit 1
}

function Assert-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Write-Error "Missing '$Name'. Install PostgreSQL 16+ client tools and add their bin directory to PATH."
    exit 1
  }
}

Assert-Command pg_dump
Assert-Command pg_restore

$dump = Join-Path ([System.IO.Path]::GetTempPath()) ("tourney-db-copy-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".dump")

try {
  Write-Host "Dumping STAGING -> $dump"
  & pg_dump --format=custom --no-owner --no-acl $SourceUrl --file=$dump
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit $LASTEXITCODE" }

  Write-Warning @"

================================================================
DESTRUCTIVE: The next step runs pg_restore --clean on PRODUCTION.
Every object in the production database will be dropped/replaced
to match this dump (all data loss on prod not present in staging).

Verify PRODUCTION_DATABASE_URL is really production, then press Enter.
Ctrl+C to cancel.
================================================================
"@
  [void](Read-Host)

  Write-Host "Restoring into PRODUCTION…"
  & pg_restore --verbose --clean --if-exists --no-owner --no-acl --dbname=$TargetUrl $dump
  $code = $LASTEXITCODE
  # pg_restore often returns 1 when non-fatal warnings occurred
  if ($code -ne 0 -and $code -ne 1) {
    throw "pg_restore failed with exit $code"
  }
  Write-Host "Restore finished (exit $code). Smoke-test https://royalorange.ca and admin."
}
finally {
  if (Test-Path -LiteralPath $dump) {
    Remove-Item -LiteralPath $dump -Force
  }
}
