$ErrorActionPreference = 'Stop'
$deliveryDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../final-submission-20260917'))
$renderDirectory = Join-Path $PSScriptRoot 'rendered'
New-Item -ItemType Directory -Path $renderDirectory -Force | Out-Null
$word = New-Object -ComObject Word.Application
$initialDocumentCount = $word.Documents.Count
$word.Visible = $false
$word.DisplayAlerts = 0
$word.AutomationSecurity = 3
$observations = @()
try {
    foreach ($reportName in @('CASE-STUDY-common-ground-ballot', 'EVAL-REPORT-common-ground-ballot')) {
        $document = $null
        try {
            $documentPath = Join-Path $deliveryDirectory ($reportName + '.docx')
            $pdfPath = Join-Path $renderDirectory ($reportName + '.pdf')
            $document = $word.Documents.Open($documentPath, $false, $true, $false)
            $document.Repaginate()
            $document.ExportAsFixedFormat($pdfPath, 17)
            $observations += [pscustomobject]@{
                document = $reportName + '.docx'
                pages = $document.ComputeStatistics(2)
                words = $document.ComputeStatistics(0)
                pdf = $pdfPath
                opened_and_rendered = $true
            }
        } finally {
            if ($null -ne $document) {
                $document.Close(0)
                [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document)
            }
        }
    }
} finally {
    if ($initialDocumentCount -eq 0) { $word.Quit() }
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
}
$observations | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'word-render-observations.json') -Encoding utf8
$observations | ConvertTo-Json -Depth 5
