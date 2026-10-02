from pathlib import Path

task = Path('projects/colderwater-playground-devtools')

def replace(path, old, new):
    file = task / path
    text = file.read_text(encoding='utf-8')
    assert text.count(old) == 1, (path, old[:70])
    file.write_text(text.replace(old, new), encoding='utf-8', newline='\n')

replace('environment/instructions/behaviour.md',
        'including text I typed into its inputs and changes made by its buttons.',
        'including text I typed into its inputs, changes made by its buttons and ordinary 2D canvas drawings.')
replace('tests/app_context.md',
        'Render proves a basic authored Run and Constraints',
        'Render proves a basic authored Run with a fresh computed result in the preview and console, and Constraints')
replace('tests/scored/functional/prompt.md',
        'The UI must offer a way to retry the same attempt after the unconfirmed result. Invoke that action; its response identifies the just-recorded committed revision and fresh head/history show no second write. Accept any usable retry control, not a fixed label.',
        'Accept automatic recovery that retries the same attempt, or a usable user action to retry while the result remains unconfirmed. If recovery is automatic, observe that retry without forcing another click; otherwise invoke the offered action. Its acknowledgement identifies the just-recorded committed revision and fresh head/history show no second write. Do not require a manual control after an automatic retry has already confirmed the result, or a fixed label.')
replace('tests/scored/functional/prompt.md',
        "document.body.innerHTML = '<p>latest-good-B</p><label>Preview note <input id=\"saved-preview-note\" value=\"initial\"></label>';\ndocument.getElementById('saved-preview-note').addEventListener('input', () => console.log('preview-note-edited'));\nconsole.log('latest-good-B-completed');",
        "document.body.innerHTML = '<p>latest-good-B</p><label>Preview note <input id=\"saved-preview-note\" value=\"initial\"></label><canvas id=\"saved-picture\" width=\"100\" height=\"60\"></canvas><button id=\"paint-picture\">Paint picture</button>';\ndocument.getElementById('saved-preview-note').addEventListener('input', () => console.log('preview-note-edited'));\ndocument.getElementById('paint-picture').addEventListener('click', () => { const brush = document.getElementById('saved-picture').getContext('2d'); brush.fillStyle = '#e02424'; brush.fillRect(0, 0, 100, 60); console.log('picture-painted'); });\nconsole.log('latest-good-B-completed');")
replace('tests/scored/functional/prompt.md',
        'Observe the input handler\'s log and completed state. Record the actual displayed value and render as currentLastGood.',
        'Observe the input handler\'s log and completed state. Click the preview\'s Paint picture button, observe its log and the red rectangle, and wait for completion. Record the actual displayed input value and picture as currentLastGood.')
replace('tests/scored/functional/prompt.md',
        '(latest-good-B and the Preview note field still showing its recorded user-entered value),',
        '(latest-good-B, the Preview note field still showing its recorded user-entered value, and the red drawing),')
replace('tests/scored/functional/prompt.md',
        'About 14 UI actions; execute once in the phase plan below.',
        'About 15 UI actions; execute once in the phase plan below.')
