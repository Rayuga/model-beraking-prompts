"""Render the final DOCX files with typed Word COM, without blocking Repaginate."""
from pathlib import Path
import json
import win32com.client

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / 'final-submission-20260917'
rendered = HERE / 'rendered'
rendered.mkdir(exist_ok=True)
word = win32com.client.gencache.EnsureDispatch('Word.Application')
word.Visible = False
word.DisplayAlerts = 0
word.AutomationSecurity = 3
observations = []
try:
    for stem in ['CASE-STUDY-common-ground-ballot', 'EVAL-REPORT-common-ground-ballot']:
        source, target = OUT / (stem + '.docx'), rendered / (stem + '.pdf')
        document = None
        try:
            for index in range(1, word.Documents.Count + 1):
                candidate = word.Documents.Item(index)
                if Path(candidate.FullName).resolve() == source.resolve():
                    document = candidate
                    break
            if document is None:
                document = word.Documents.Open(str(source), ConfirmConversions=False, ReadOnly=True, AddToRecentFiles=False)
            document.ExportAsFixedFormat(str(target), 17)
            observations.append(dict(document=source.name, pages=document.ComputeStatistics(2), words=document.ComputeStatistics(0), pdf=str(target), opened_and_rendered=True))
            print(source.name, 'rendered:', observations[-1]['pages'], 'pages', flush=True)
        finally:
            if document is not None:
                document.Close(0)
finally:
    if word.Documents.Count == 0:
        word.Quit()
(HERE / 'word-render-observations.json').write_text(json.dumps(observations, indent=2) + '\n')
