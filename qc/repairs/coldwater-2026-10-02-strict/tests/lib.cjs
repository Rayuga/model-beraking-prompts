// Shared helpers for the scripted golden checks. Runs inside the verifier image,
// in the app container's network namespace, so the app is http://localhost:3000
// exactly as the judge sees it. No clipboard permissions are granted.
const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');

const ORIGIN = process.env.CW_URL || 'http://localhost:3000/';

async function launch() {
  return chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
}

async function openPage(browser, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', error => page.errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.goto(ORIGIN, { waitUntil: 'networkidle' });
  return page;
}

const editorOf = page => page.getByRole('textbox', { name: 'Code editor' });
const source = async page => (await editorOf(page).locator('.line .text').evaluateAll(nodes => nodes.map(node => node.dataset.lineText))).join('\n');
const cursor = async page => (await page.locator('#cursor-label').innerText()).trim();
const consoleText = async page => (await page.getByRole('log', { name: 'Console output' }).innerText());
const status = async page => (await page.locator('.runstatus').innerText());
const preview = page => page.frameLocator('iframe[title="Live preview"]');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Fixture entry shortcut: a paste event carrying the text. Graded behaviours are
// still exercised with real keys and mouse actions.
async function setSource(page, text) {
  await editorOf(page).click();
  await page.keyboard.press('ControlOrMeta+A');
  if (text === '') { await page.keyboard.press('Backspace'); return; }
  await editorOf(page).evaluate((node, value) => {
    const data = new DataTransfer(); data.setData('text/plain', value);
    node.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, text);
  assert.equal(await source(page), text);
}

async function fresh(page) {
  await page.goto(ORIGIN, { waitUntil: 'networkidle' });
}

async function setFile(page, filename, title) {
  await page.getByRole('textbox', { name: 'Filename' }).fill(filename);
  if (title !== undefined) await page.getByRole('textbox', { name: 'Snippet title' }).fill(title);
}

async function run(page, wait = 700) {
  await page.getByRole('button', { name: /^Run/ }).click();
  await sleep(wait);
}

// Click at a character position inside a logical line using its rendered box.
async function pointAt(page, line, col) {
  return editorOf(page).evaluate((root, [lineIndex, column]) => {
    const text = root.querySelector(`.line[data-line="${lineIndex}"] .text`);
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    let node, seen = 0;
    while ((node = walker.nextNode())) {
      if (column <= seen + node.length) {
        const range = document.createRange();
        range.setStart(node, column - seen); range.collapse(true);
        const box = range.getBoundingClientRect();
        return { x: box.left, y: box.top + box.height / 2 };
      }
      seen += node.length;
    }
    const box = text.getBoundingClientRect();
    return { x: box.right - 2, y: box.top + box.height / 2 };
  }, [line, col]);
}

async function clickAt(page, line, col, options = {}) {
  const point = await pointAt(page, line, col);
  const { modifiers = [], ...rest } = options;
  for (const key of modifiers) await page.keyboard.down(key);
  await page.mouse.click(point.x + 0.5, point.y, rest);
  for (const key of modifiers) await page.keyboard.up(key);
}

// Copy the live editor selection with the real shortcut and read it back by
// pasting into the Find field, which is an ordinary input.
async function copied(page) {
  await page.keyboard.press('ControlOrMeta+C');
  const find = page.getByRole('textbox', { name: 'Find in code' });
  const before = await find.inputValue();
  await find.focus(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.press('ControlOrMeta+V');
  const value = await find.inputValue();
  await find.fill(before);
  await editorOf(page).focus();
  return value;
}

function report(name, results, page) {
  console.log(JSON.stringify({ suite: name, results, pageErrors: page?.errors || [] }, null, 2));
}

module.exports = { assert, launch, openPage, editorOf, source, cursor, consoleText, status, preview, sleep, setSource, fresh, setFile, run, pointAt, clickAt, copied, report, ORIGIN };
