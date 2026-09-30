param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$cleanupRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$deliverablesRoot = [System.IO.Path]::GetFullPath((Join-Path $cleanupRoot 'deliverables'))
$restoreCommit = (git -C $cleanupRoot rev-parse HEAD).Trim()
$tracked = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
git -C $cleanupRoot ls-files | ForEach-Object { [void]$tracked.Add($_) }
$plan = @()
$candidates = Get-ChildItem -LiteralPath $deliverablesRoot -Directory -Recurse |
    Where-Object { $_.Name -like 'archive-check-*' -or $_.Name -like 'archive-source-check-*' }
foreach ($directory in $candidates) {
    $absolute = [System.IO.Path]::GetFullPath($directory.FullName)
    if (-not $absolute.StartsWith($deliverablesRoot + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw "Outside cleanup boundary: $absolute" }
    $entries = @(Get-ChildItem -LiteralPath $absolute -Force -Recurse)
    if (($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) -or @($entries | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) { throw "Refusing linked tree: $absolute" }
    $files = @($entries | Where-Object { -not $_.PSIsContainer })
    $relative = $absolute.Substring($cleanupRoot.Length + 1).Replace('\','/')
    $untracked = @($files | Where-Object { -not $tracked.Contains($_.FullName.Substring($cleanupRoot.Length + 1).Replace('\','/')) })
    if ($untracked.Count) { continue }
    git -C $cleanupRoot diff --quiet HEAD -- $relative
    if ($LASTEXITCODE -ne 0) { continue }
    $plan += [pscustomobject]@{path=$relative;files=$files.Count;bytes=($files | Measure-Object Length -Sum).Sum;restore_commit=$restoreCommit;reason='Unmodified committed archive-validation extraction; ZIPs and original evidence retained'}
}
$cacheRoots = @('scripts','deliverables','harbor-webdev-rubric-qc','codearena-task-breaker')
$cachePlan = @()
foreach ($rel in $cacheRoots) {
    $base = Join-Path $cleanupRoot $rel
    Get-ChildItem -LiteralPath $base -Directory -Recurse -Force | Where-Object { $_.Name -eq '__pycache__' } | ForEach-Object {
        $absolute = [IO.Path]::GetFullPath($_.FullName)
        if (-not $absolute.StartsWith($cleanupRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw "Outside workspace: $absolute" }
        $entries = @(Get-ChildItem -LiteralPath $absolute -Recurse -Force)
        if (($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -or @($entries | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) { throw "Linked cache: $absolute" }
        if (@($entries | Where-Object { -not $_.PSIsContainer -and $_.Extension -ne '.pyc' }).Count) { return }
        $cachePlan += [pscustomobject]@{path=$absolute.Substring($cleanupRoot.Length+1).Replace('\','/');files=@($entries | Where-Object { -not $_.PSIsContainer }).Count;bytes=($entries | Where-Object { -not $_.PSIsContainer } | Measure-Object Length -Sum).Sum;reason='Reproducible Python bytecode'}
    }
}
$report = [ordered]@{applied=[bool]$Apply;restore_commit=$restoreCommit;extractions=$plan;caches=$cachePlan;removed_files=0;removed_bytes=0}
if ($Apply) {
    foreach ($item in @($plan)+@($cachePlan)) {
        $absolute = [IO.Path]::GetFullPath((Join-Path $cleanupRoot $item.path))
        if (-not $absolute.StartsWith($cleanupRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw "Invalid removal target: $absolute" }
        Remove-Item -LiteralPath $absolute -Recurse -Force
        $report.removed_files += $item.files
        $report.removed_bytes += $item.bytes
    }
    $logDir = Join-Path $cleanupRoot 'qc/cleanup'
    [void](New-Item -ItemType Directory -Path $logDir -Force)
    $logName = (Get-Date -Format 'yyyy-MM-dd-HHmmss-fff') + '.json'
    $report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $logDir $logName) -Encoding UTF8
}
$report | ConvertTo-Json -Depth 6
