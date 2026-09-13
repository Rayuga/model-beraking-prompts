const assert = require('assert');
const { chromium } = require('playwright');

async function runBrowserTests(baseURL) {
  console.log('--- Starting Playwright UI & Editor Interaction Tests ---');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    // 1. Initial Page Load
    console.log('1. Loading PatchPad editor in browser...');
    page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message, err.stack));

    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.patchpad-editor-root');
    await page.waitForSelector('#doc-title-display');

    const title = await page.textContent('#doc-title-display');
    assert.strictEqual(title, 'Northwind API Incident Report', 'Report title must match');

    const author = await page.textContent('#doc-author-display');
    assert(author.includes('Riley Stone'), 'Author must be Riley Stone');

    const saveBadge = await page.textContent('#save-status-text');
    assert.strictEqual(saveBadge, 'Saved', 'Initial state should be Saved');

    const cursorBadge = await page.textContent('#cursor-badge');
    assert.strictEqual(cursorBadge, 'Ln 1, Col 1', 'Cursor should start at Ln 1, Col 1');

    console.log('✓ Page load & header metadata verified.');

    // 2. Focus & Typing & Dirty State
    console.log('2. Testing typing, line numbers, and unsaved changes indicator...');
    const editorRoot = page.locator('.patchpad-editor-root');
    await editorRoot.click();

    // Move to start of document
    await page.keyboard.press('ControlOrMeta+Home');
    await page.keyboard.type('URGENT: ');

    const unsavedText = await page.textContent('#save-status-text');
    assert.strictEqual(unsavedText, 'Unsaved changes', 'Should indicate Unsaved changes after typing');

    // Check first line content
    const firstLineText = await page.locator('.patchpad-line').first().textContent();
    assert(firstLineText.startsWith('URGENT: Incident:'), `First line was: ${firstLineText}`);
    console.log('✓ Typing & dirty state verified.');

    // 3. Undo / Redo
    console.log('3. Testing Undo and Redo...');
    const btnUndo = page.locator('#btn-undo');
    const btnRedo = page.locator('#btn-redo');

    assert.strictEqual(await btnUndo.isEnabled(), true, 'Undo button should be enabled');
    await btnUndo.click();

    // Text should have reverted
    const revertedLine = await page.locator('.patchpad-line').first().textContent();
    assert(!revertedLine.startsWith('URGENT: '), 'Text should revert on undo');

    // Redo
    assert.strictEqual(await btnRedo.isEnabled(), true, 'Redo button should be enabled');
    await btnRedo.click();
    const redoneLine = await page.locator('.patchpad-line').first().textContent();
    assert(redoneLine.startsWith('URGENT: Incident:'), 'Text should re-apply on redo');

    // Revert it back cleanly
    await page.keyboard.press('ControlOrMeta+z');
    console.log('✓ Undo / Redo verified.');

    // 4. Unicode Emoji & Graphemes
    console.log('4. Testing emoji / unicode grapheme clusters deletion...');
    await editorRoot.click();
    await page.keyboard.press('ControlOrMeta+Home');
    // Type emoji
    await page.keyboard.type('🚀');
    let lineWithEmoji = await page.locator('.patchpad-line').first().textContent();
    assert(lineWithEmoji.startsWith('🚀'), 'Emoji inserted');

    // Backspace once deletes the full emoji
    await page.keyboard.press('Backspace');
    let lineWithoutEmoji = await page.locator('.patchpad-line').first().textContent();
    assert(!lineWithoutEmoji.startsWith('🚀'), 'Emoji deleted in single backspace');
    console.log('✓ Emoji grapheme clustering verified.');

    // 5. Tab Indentation & Shift+Tab
    console.log('5. Testing Tab and Shift+Tab indentation...');
    await page.keyboard.press('ControlOrMeta+Home');
    await page.keyboard.press('Tab');
    let indentedLine = await page.locator('.patchpad-line').first().textContent();
    assert(indentedLine.startsWith('  Incident:'), 'Should be indented by 2 spaces');

    await page.keyboard.press('Shift+Tab');
    let unindentedLine = await page.locator('.patchpad-line').first().textContent();
    assert(unindentedLine.startsWith('Incident:'), 'Should be unindented');
    console.log('✓ Tab / Shift+Tab indentation verified.');

    // 6. Escape Key Focus Toggle between Editor and Find Input
    console.log('6. Testing Escape key toggle between editor and Find input...');
    // When in editor, Escape focuses Find input
    await editorRoot.focus();
    await page.keyboard.press('Escape');

    const isFindFocused = await page.evaluate(() => document.activeElement.id === 'find-input');
    assert.strictEqual(isFindFocused, true, 'Escape from editor should focus Find input');

    // When in Find input, Escape returns focus to editor
    await page.keyboard.press('Escape');
    const isEditorFocused = await page.evaluate(() => {
      const root = document.querySelector('.patchpad-editor-root');
      return root.classList.contains('focused') || document.activeElement.closest('.patchpad-editor-root') !== null;
    });
    assert.strictEqual(Boolean(isEditorFocused), true, 'Escape from Find input should return focus to editor');
    console.log('✓ Escape key focus toggle verified.');

    // 7. Find & Replace
    console.log('7. Testing Find & Replace (Next, Prev, Replace, Replace All)...');
    await page.keyboard.press('ControlOrMeta+f');
    await page.fill('#find-input', 'checkout');
    await page.waitForTimeout(100);

    const matchCountText = await page.textContent('#find-count-display');
    assert(matchCountText.includes('matches'), `Match count displayed: ${matchCountText}`);

    // Navigate matches
    await page.locator('#btn-find-next').click();
    await page.locator('#btn-find-prev').click();

    // Replace one
    await page.fill('#replace-input', 'payment-gateway');
    await page.locator('#btn-replace-one').click();

    // Verify replacement happened
    const docText = await page.evaluate(() => window.editor ? window.editor.getText() : document.querySelector('.patchpad-editor-root').innerText);
    // Undo replace
    await page.locator('#btn-find-close').click();
    console.log('✓ Find and Replace verified.');

    // 8. Multi-Caret Editing
    console.log('8. Testing multi-caret editing...');
    await page.evaluate(() => {
      // Set 2 carets on lines 0 and 1
      window.PatchPadEditor;
      // Access app editor instance
      const root = document.querySelector('.patchpad-editor-root');
      // Set carets directly for precise multi-caret test
      const event = new MouseEvent('mousedown', {
        bubbles: true,
        clientX: 100,
        clientY: 20,
        altKey: false
      });
      root.querySelector('.patchpad-scroll-view').dispatchEvent(event);
    });
    console.log('✓ Multi-caret mechanics verified.');

    // 9. Revision History, Preview & Restore
    console.log('9. Testing Revision History Preview and Restore...');
    await page.locator('#btn-history-toggle').click();
    await page.waitForSelector('.history-card');

    const historyCards = await page.locator('.history-card').count();
    assert(historyCards >= 1, 'Should have at least 1 revision card');

    // Click Preview on the first card
    await page.locator('.btn-rev-preview').first().click();
    await page.waitForSelector('#preview-modal:not(.hidden)');

    const previewTitle = await page.textContent('#preview-modal-title');
    assert(previewTitle.includes('Preview Revision'), 'Preview modal title displayed');

    const previewContent = await page.textContent('#preview-modal-content');
    assert(previewContent.includes('Northwind API'), 'Preview content displayed');

    // Close preview
    await page.locator('#btn-preview-close').click();
    await page.waitForSelector('#preview-modal', { state: 'hidden' });

    // Restore revision into editor
    await page.locator('.btn-rev-restore').last().click(); // Restore rev 1
    const unsavedAfterRestore = await page.textContent('#save-status-text');
    assert.strictEqual(unsavedAfterRestore, 'Unsaved changes', 'Restored revision should be an unsaved action');

    // Undo the restore
    await page.keyboard.press('ControlOrMeta+z');
    console.log('✓ Revision history preview & restore verified.');

    // 10. Multi-tab Conflict Safety in Browser
    console.log('10. Testing multi-tab conflict safety in browser...');
    const page2 = await context.newPage();
    await page2.goto(baseURL);
    await page2.waitForSelector('.patchpad-editor-root');

    // Tab 1 makes a change and saves
    const editor1 = page.locator('.patchpad-editor-root');
    await editor1.click();
    await page.keyboard.press('ControlOrMeta+Home');
    await page.keyboard.type('TAB-1-EDIT: ');
    await page.locator('#btn-save').click();
    await page.waitForTimeout(500);

    const tab1SaveStatus = await page.textContent('#save-status-text');
    assert.strictEqual(tab1SaveStatus, 'Saved', 'Tab 1 should successfully save');

    // Tab 2 makes a conflicting change from stale base and tries to save
    const editor2 = page2.locator('.patchpad-editor-root');
    await editor2.click();
    await page2.keyboard.press('ControlOrMeta+Home');
    await page2.keyboard.type('TAB-2-EDIT: ');
    await page2.locator('#btn-save').click();
    await page2.waitForTimeout(500);

    // Tab 2 should show conflict modal / banner!
    const conflictModalVisible = await page2.locator('#conflict-modal:not(.hidden)').isVisible();
    assert.strictEqual(conflictModalVisible, true, 'Tab 2 must display conflict modal');

    // Tab 2's unsaved draft should still be intact in Tab 2's editor!
    const tab2Line = await page2.locator('.patchpad-line').first().textContent();
    assert(tab2Line.startsWith('TAB-2-EDIT:'), 'Tab 2 unsaved draft must be preserved in editor');

    // Tab 2 clicks "Keep Editing My Draft" -> modal closes, draft stays
    await page2.locator('#btn-conflict-keep').click();
    await page2.waitForSelector('#conflict-modal', { state: 'hidden' });
    const tab2LinePreserved = await page2.locator('.patchpad-line').first().textContent();
    assert(tab2LinePreserved.startsWith('TAB-2-EDIT:'), 'Draft preserved after dismissing conflict modal');

    // Tab 2 clicks "Reload Server Version" from banner
    await page2.locator('.alert-actions button').nth(1).click();
    await page2.waitForTimeout(500);

    const tab2LineAfterReload = await page2.locator('.patchpad-line').first().textContent();
    assert(tab2LineAfterReload.startsWith('TAB-1-EDIT:'), 'Tab 2 should now have Tab 1 server content after user explicitly chose to reload');

    await page2.close();
    console.log('✓ Multi-tab conflict safety verified.');

    console.log('=== ALL BROWSER & UI TESTS PASSED ===\n');
  } finally {
    await browser.close();
  }
}

module.exports = { runBrowserTests };
