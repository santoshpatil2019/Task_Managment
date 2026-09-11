param([Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
if (-not $env:PGHOST -or -not $env:PGUSER -or -not $env:PGPASSWORD) { throw 'Set PGHOST, PGUSER, PGPASSWORD, PGDATABASE and PGPORT securely before running. Do not commit credentials.' }
Get-Command pg_dump -ErrorAction Stop | Out-Null
$backupRoot = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
$backupFile = Join-Path $backupRoot ('mellivo-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump')
$env:PGSSLMODE = 'require'
& pg_dump --format=custom --no-owner --no-acl --file $backupFile
if ($LASTEXITCODE -ne 0) { throw 'Database backup failed. Do not use the incomplete file.' }
& pg_restore --list $backupFile | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Backup archive could not be read.' }
Get-FileHash -Algorithm SHA256 -LiteralPath $backupFile | ConvertTo-Json | Set-Content ($backupFile + '.sha256.json')
Write-Output "Database archive created: $backupFile. Storage file bytes require a separate export."
