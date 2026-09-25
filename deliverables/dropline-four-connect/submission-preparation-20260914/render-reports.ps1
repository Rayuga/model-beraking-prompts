$ErrorActionPreference = 'Stop'
$deliveryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../final-submission-20260914'))
$word = $null
$document = $null
$checks = @()
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.AutomationSecurity = 3
    Write-Output 'Word automation initialized'
    foreach ($kind in @('CASE-STUDY', 'EVAL-REPORT')) {
        [string]$inputFile = Join-Path $deliveryRoot "$kind-dropline-four-connect.docx"
        [string]$outputFile = Join-Path $PSScriptRoot "$kind-dropline-four-connect.pdf"
        $beforeHash = (Get-FileHash -LiteralPath $inputFile -Algorithm SHA256).Hash
        [bool]$falseValue = $false
        [bool]$readOnlyValue = $true
        Write-Output "Opening $kind"
        $document = $word.Documents.Open([ref]$inputFile, [ref]$falseValue, [ref]$readOnlyValue, [ref]$falseValue)
        Write-Output "Opened $kind"
        $document.Repaginate()
        $pages = $document.ComputeStatistics(2)
        $document.ExportAsFixedFormat($outputFile, 17)
        $document.Close(0)
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document)
        $document = $null
        if ((Get-FileHash -LiteralPath $inputFile -Algorithm SHA256).Hash -ne $beforeHash) { throw 'Report was modified unexpectedly' }
        $checks += [pscustomobject]@{report=[IO.Path]::GetFileName($inputFile);opened=$true;pages=$pages;pdf=$outputFile;docx_unchanged=$true}
    }
    $checks | ConvertTo-Json -Depth 3
} finally {
    if ($null -ne $document) { $document.Close(0); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document) }
    if ($null -ne $word) { $word.Quit(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word) }
}
