$runRoot = 'run-outputs/pellmoor-job-pipeline/run-7d9b3680-af7f-400b-9bda-07a133d8f7b2/pellmoor-job-pipeline__fPdsGjc'
$outputRoot = 'deliverables/pellmoor-job-pipeline/1.0.0-r8-reliability-20260914'
$trajectory = Get-Content -Raw "$runRoot/agent/trajectory.json" | ConvertFrom-Json
$hits = @()
foreach ($step in $trajectory.steps) {
    foreach ($item in $step.observation.results) {
        if ($item.content -is [string] -and $item.content.Contains('error while loading shared libraries: libglib-2.0.so.0')) {
            $index = $item.content.IndexOf('error while loading shared libraries: libglib-2.0.so.0')
            $start = [Math]::Max(0, $index - 140)
            $length = [Math]::Min(400, $item.content.Length - $start)
            $hits += [ordered]@{
                step_id = $step.step_id
                timestamp = $step.timestamp
                excerpt = $item.content.Substring($start, $length)
            }
        }
    }
}
$sourceMatches = @(Select-String -LiteralPath "$runRoot/artifacts/app/src/app.ts" -Pattern 'renderActivityList' | ForEach-Object {
    [ordered]@{line=$_.LineNumber; text=$_.Line.Trim()}
})
$evidence = [ordered]@{
    trial = 'pellmoor-job-pipeline__fPdsGjc'
    model = 'gpt-5.4-mini'
    trajectory_sha256 = (Get-FileHash "$runRoot/agent/trajectory.json" -Algorithm SHA256).Hash.ToLowerInvariant()
    library_failure_observations = $hits
    final_handoff_step = 59
    final_handoff = $trajectory.steps[-1].tool_calls[0].arguments.message
    missing_frontend_function_references = $sourceMatches
    conclusion = 'The product has an undefined renderActivityList reference in its vacancy view. GPT attempted a real browser check, but the downloaded Chromium could not load libglib-2.0.so.0. Provisioning a working browser gives every solver the same feasible check; it does not repair this submitted app, award a pass, or change the browser gate.'
}
$evidence | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 "$outputRoot/gpt-browser-runtime-evidence.json"
$hashes = [ordered]@{}
foreach ($relative in @('environment/Dockerfile', 'environment/instructions/browser-check.md', 'instruction.md')) {
    $hashes[$relative] = (Get-FileHash "projects/pellmoor-job-pipeline/$relative" -Algorithm SHA256).Hash.ToLowerInvariant()
}
$hashes | ConvertTo-Json | Set-Content -Encoding utf8 "$outputRoot/environment-source-hashes.json"
$evidence.library_failure_observations | ConvertTo-Json -Depth 4
