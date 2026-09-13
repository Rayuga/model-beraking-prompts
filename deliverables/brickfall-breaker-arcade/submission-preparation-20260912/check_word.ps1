$ErrorActionPreference = 'Stop'
$brickEvidence = $PSScriptRoot
$brickDelivery = Join-Path (Split-Path -Parent $brickEvidence) 'final-submission-20260912'
$brickWord = $null
$brickResults = @()
$brickFalse = $false
$brickDiscard = 0
$brickPageUnit = 1
$brickAbsolute = 1
$brickPagesStatistic = 2
try {
    $brickWord = New-Object -ComObject Word.Application
    $brickWord.Visible = $false
    $brickWord.DisplayAlerts = 0
    $brickWord.AutomationSecurity = 3
    foreach ($brickName in @('EVAL-REPORT-brickfall-breaker-arcade.docx', 'CASE-STUDY-brickfall-breaker-arcade.docx')) {
        $brickPath = Join-Path $brickDelivery $brickName
        $brickBefore = (Get-FileHash -LiteralPath $brickPath -Algorithm SHA256).Hash
        $brickDocument = $null
        try {
            $brickReadOnly = $true
            $brickDocument = $brickWord.Documents.Open([ref]$brickPath, [ref]$brickFalse, [ref]$brickReadOnly, [ref]$brickFalse)
            $brickDocument.Repaginate()
            $brickPages = $brickDocument.ComputeStatistics($brickPagesStatistic)
            $brickPdf = Join-Path $brickEvidence ([System.IO.Path]::GetFileNameWithoutExtension($brickName) + '.pdf')
            if (Test-Path -LiteralPath $brickPdf) { throw "Refusing to overwrite PDF evidence: $brickPdf" }
            $brickDocument.ExportAsFixedFormat($brickPdf, 17)
            $brickText = $brickDocument.Content.Text
            $brickPagesText = @()
            for ($brickPageIndex = 1; $brickPageIndex -le $brickPages; $brickPageIndex++) {
                $brickPageRange = $brickDocument.GoTo([ref]$brickPageUnit, [ref]$brickAbsolute, [ref]$brickPageIndex)
                $brickPageStart = $brickPageRange.Start
                if ($brickPageIndex -lt $brickPages) {
                    $brickNextIndex = $brickPageIndex + 1
                    $brickNextRange = $brickDocument.GoTo([ref]$brickPageUnit, [ref]$brickAbsolute, [ref]$brickNextIndex)
                    $brickPageEnd = $brickNextRange.Start
                    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($brickNextRange)
                } else { $brickPageEnd = $brickDocument.Content.End }
                $brickPageContent = $brickDocument.Range([ref]$brickPageStart, [ref]$brickPageEnd)
                $brickPagesText += [pscustomobject]@{page=$brickPageIndex;characters=$brickPageContent.Text.Length;opening=($brickPageContent.Text.Substring(0,[Math]::Min(160,$brickPageContent.Text.Length)) -replace '[\r\a]', ' ')}
                [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($brickPageContent)
                [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($brickPageRange)
            }
            $brickResults += [pscustomobject]@{
                file=$brickName; opened_in_word=$true; pages=$brickPages;
                tables=$brickDocument.Tables.Count; paragraph_count=$brickDocument.Paragraphs.Count;
                correct_scores=($brickText.Contains('0.9583') -and $brickText.Contains('0.6094'));
                pending_haiku=($brickText -match 'Haiku.*pending|replacement pending');
                no_reference_product=($brickText -notmatch 'drawbill|Harborview|Northline Construction');
                pdf=$brickPdf; page_details=$brickPagesText
            }
        } finally {
            if ($null -ne $brickDocument) {
                $brickDocument.Close([ref]$brickDiscard)
                [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($brickDocument)
            }
        }
        if ((Get-FileHash -LiteralPath $brickPath -Algorithm SHA256).Hash -ne $brickBefore) { throw "Word changed read-only source: $brickName" }
    }
} finally {
    if ($null -ne $brickWord) {
        $brickWord.Quit([ref]$brickDiscard)
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($brickWord)
    }
}
$brickResults | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $brickEvidence 'word-validation.json') -Encoding UTF8
$brickResults | Select-Object file,opened_in_word,pages,tables,correct_scores,pending_haiku,no_reference_product | ConvertTo-Json -Depth 3
