param([Parameter(Mandatory=$true)][string]$Archive, [Parameter(Mandatory=$true)][string]$ExpectedStagingHost)
$ErrorActionPreference='Stop'
if (-not $env:PGHOST -or $env:PGHOST -ne $ExpectedStagingHost -or $env:PGHOST -like '*smldjeqhpmpzlqzxhwlr*' -or $env:PGUSER -like '*smldjeqhpmpzlqzxhwlr*') { throw 'Use an explicitly identified staging database, never production.' }
if (-not $env:PGDATABASE -or $env:PGDATABASE -eq 'postgres') { throw 'Choose a dedicated empty restore-test database.' }
Get-Command pg_restore -ErrorAction Stop | Out-Null
$env:PGSSLMODE='require'
& pg_restore --exit-on-error --single-transaction --no-owner --no-acl --dbname $env:PGDATABASE $Archive
if($LASTEXITCODE -ne 0){throw 'Restore verification failed. Review the error; do not use this archive for recovery.'}
Write-Output 'Archive restored. Run tests/sql/permissions.sql with representative users, check row counts, sign-in and private storage before approving recovery.'
