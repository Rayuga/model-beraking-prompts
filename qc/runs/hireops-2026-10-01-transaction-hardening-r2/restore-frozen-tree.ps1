$ErrorActionPreference = 'Stop'
$taskWorkspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$cacheBoundary = [IO.Path]::GetFullPath((Join-Path $taskWorkspace '.qc-cache/hireops-2026-10-01-transaction-hardening-r2/rules'))
$generatedPath = [IO.Path]::GetFullPath((Join-Path $cacheBoundary 'harbor-webdev-rubric-qc/scripts/__pycache__/list_checks.cpython-312.pyc'))
if (-not $generatedPath.StartsWith($cacheBoundary + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Outside exact frozen-rules boundary' }
$item = Get-Item -LiteralPath $generatedPath
if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refuse linked generated file' }
$evidenceDir = Join-Path $PSScriptRoot 'local/snapshot-contamination'
[void](New-Item -ItemType Directory -Path $evidenceDir -Force)
$savedPath = Join-Path $evidenceDir 'list_checks.cpython-312.pyc.saved'
if (Test-Path -LiteralPath $savedPath) { throw 'Evidence already exists; do not overwrite' }
$beforeHash = (Get-FileHash -LiteralPath $generatedPath -Algorithm SHA256).Hash.ToLowerInvariant()
Copy-Item -LiteralPath $generatedPath -Destination $savedPath
if ((Get-FileHash -LiteralPath $savedPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $beforeHash) { throw 'Evidence copy mismatch' }
$record = [ordered]@{
  generated_file=$generatedPath
  bytes=$item.Length
  created_utc=$item.CreationTimeUtc.ToString('o')
  sha256=$beforeHash
  preserved_as=$savedPath
  scope='Unmanifested generated Python bytecode only. No declared source, rule, workbook, template or checker bytes changed. Exact file is removed after preservation to restore the frozen manifest inventory.'
  cleanup_preview='The repository cleanup script was previewed without -Apply. It does not cover .qc-cache, so no broad cleanup was applied; this operation targets only the explicitly verified generated file.'
}
$record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $evidenceDir 'restoration.json') -Encoding UTF8
Remove-Item -LiteralPath $generatedPath
if (Test-Path -LiteralPath $generatedPath) { throw 'Generated file still present' }
$record | ConvertTo-Json -Depth 5
