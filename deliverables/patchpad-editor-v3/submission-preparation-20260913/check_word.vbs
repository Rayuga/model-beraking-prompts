Option Explicit
Dim fso, base, delivery, app, names, name, doc, pdf, pageCount, text, result, failed, message, validation, separator, validationFile
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
delivery = fso.BuildPath(fso.GetParentFolderName(base), "final-submission-20260913")
names = Array("EVAL-REPORT-patchpad-editor-v3.docx", "CASE-STUDY-patchpad-editor-v3.docx")
On Error Resume Next
Set app = CreateObject("Word.Application")
If Err.Number <> 0 Then
    WScript.Echo "Word startup failed: " & Err.Description
    WScript.Quit 1
End If
app.Visible = False
app.DisplayAlerts = 0
app.AutomationSecurity = 3
failed = False
validation = "["
separator = ""
For Each name In names
    Err.Clear
    Set doc = app.Documents.Open(fso.BuildPath(delivery, name), False, True, False)
    If Err.Number <> 0 Then
        failed = True
        WScript.Echo "Open failed: " & name & ": " & Err.Description
        Exit For
    End If
    doc.Repaginate
    pageCount = doc.ComputeStatistics(2)
    text = doc.Content.Text
    pdf = fso.BuildPath(base, fso.GetBaseName(name) & ".pdf")
    If fso.FileExists(pdf) Then
        failed = True
        WScript.Echo "Refusing to overwrite existing PDF evidence: " & pdf
        doc.Close 0
        Exit For
    End If
    doc.ExportAsFixedFormat pdf, 17
    If Err.Number <> 0 Then
        failed = True
        WScript.Echo "Render failed: " & name & ": " & Err.Description
    Else
        WScript.Echo name & " | pages=" & pageCount & " | tables=" & doc.Tables.Count & " | opened=true | pdf=true"
        validation = validation & separator & "{""file"":""" & name & """,""pages"":" & pageCount & ",""word_opened"":true,""tables"":" & doc.Tables.Count & "}"
        separator = ","
        If InStr(text, "1.0000") = 0 Or InStr(text, "0.5605") = 0 Or InStr(text, "0.2233") = 0 Then
            failed = True
            WScript.Echo "Missing required report content"
        End If
        If InStr(LCase(text), "drawbill") > 0 Or InStr(text, "Harborview") > 0 Then
            failed = True
            WScript.Echo "Unexpected reference-project content"
        End If
    End If
    doc.Close 0
    Set doc = Nothing
Next
app.Quit 0
Set app = Nothing
If failed Then WScript.Quit 1
Set validationFile = fso.CreateTextFile(fso.BuildPath(base, "word-validation.json"), True)
validationFile.Write validation & "]"
validationFile.Close
WScript.Echo "PASS: both reports opened and rendered read-only; expected scores including completed Haiku present."
