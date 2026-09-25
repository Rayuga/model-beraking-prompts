param(
  [ValidateSet('golden','readonly','create_only','publish_stub')]
  [string]$Variant = 'golden',
  [string]$Image = 'ballot-verifier:20260915-r18-local'
)
$ReportRoot = $PSScriptRoot
$WorkspaceRoot = [System.IO.Path]::GetFullPath((Join-Path $ReportRoot '../../..'))
$GoldenRoot = Join-Path $WorkspaceRoot 'projects/common-ground-ballot/solution'
$SeedRoot = Join-Path $WorkspaceRoot 'projects/common-ground-ballot/environment/assets/artifacts'
$ResultRoot = Join-Path $ReportRoot ('gate-' + $Variant)
New-Item -ItemType Directory -Force -Path $ResultRoot | Out-Null
docker run --rm --network none --env 'NO_PROXY=localhost,127.0.0.1,::1' --env 'no_proxy=localhost,127.0.0.1,::1' --env ('PRODUCT_GATE_MUTANT=' + $Variant) --mount ('type=bind,source=' + $GoldenRoot + ',target=/golden,readonly') --mount ('type=bind,source=' + $SeedRoot + ',target=/seed,readonly') --mount ('type=bind,source=' + $ReportRoot + ',target=/validation,readonly') --mount ('type=bind,source=' + $ResultRoot + ',target=/results') $Image python3 /validation/run-product-gate.py
exit $LASTEXITCODE
