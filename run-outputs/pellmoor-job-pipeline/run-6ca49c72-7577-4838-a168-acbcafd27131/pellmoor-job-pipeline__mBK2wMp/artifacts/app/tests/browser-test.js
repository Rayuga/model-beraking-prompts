const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

const BROWSER_PATH = '/usr/bin/chromium';
const TEST_DB = path.join(__dirname, 'browser_test_pellmoor.db');
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

let serverProcess = null;

async function waitForServer(url, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 400) resolve();
          else reject(new Error(`Status ${res.statusCode}`));
        });
        req.on('error', reject);
        req.end();
      });
      return;
    } catch (e) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  throw new Error(`Server at ${url} did not start in ${timeoutMs}ms`);
}

async function runBrowserTest() {
  console.log('--- Starting Real Browser End-to-End Test ---');

  // Start delivered server
  serverProcess = spawn('node', ['backend/server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '3000', DB_PATH: TEST_DB },
    stdio: 'inherit'
  });

  await waitForServer('http://127.0.0.1:3000/');
  console.log('Server is running on http://127.0.0.1:3000');

  const browser = await puppeteer.launch({
    executablePath: BROWSER_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const networkResponses = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('Browser console error:', msg.text());
      consoleErrors.push(msg.text());
    } else {
      console.log('Browser log:', msg.text());
    }
  });

  page.on('pageerror', err => {
    console.error('Browser page error:', err);
    pageErrors.push(err.message);
  });

  page.on('response', response => {
    networkResponses.push({
      url: response.url(),
      status: response.status(),
      contentType: response.headers()['content-type'] || ''
    });
  });

  try {
    // 1. Navigate to index page
    console.log('1. Navigating to http://localhost:3000/...');
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' });

    // Verify bundle.js and styles.css content types and contents
    console.log('2. Verifying asset Content-Types...');
    const jsAsset = networkResponses.find(r => r.url.endsWith('/bundle.js'));
    const cssAsset = networkResponses.find(r => r.url.endsWith('/styles.css') || r.url.endsWith('/bundle.css'));

    if (!jsAsset) throw new Error('bundle.js was not requested');
    if (!jsAsset.contentType.includes('javascript')) {
      throw new Error(`bundle.js Content-Type is invalid: ${jsAsset.contentType}`);
    }

    if (!cssAsset) throw new Error('styles.css was not requested');
    if (!cssAsset.contentType.includes('text/css')) {
      throw new Error(`styles.css Content-Type is invalid: ${cssAsset.contentType}`);
    }

    console.log(`✓ bundle.js loaded with Content-Type: ${jsAsset.contentType}`);
    console.log(`✓ styles.css loaded with Content-Type: ${cssAsset.contentType}`);

    // 3. Check login page and click Ruth Aldane demo login
    console.log('3. Logging in as Ruth Aldane...');
    await page.waitForSelector('.demo-account-btn[data-email="hiring@pellmoor.test"]');
    await page.click('.demo-account-btn[data-email="hiring@pellmoor.test"]');

    // 4. Verify workspace loaded
    console.log('4. Verifying workspace loaded...');
    await page.waitForSelector('.workspace-layout', { timeout: 5000 });
    await page.waitForSelector('.vacancy-tab-btn');

    // Verify vacancy tabs
    const tabs = await page.$$('.vacancy-tab-btn');
    console.log(`Found ${tabs.length} vacancy tabs`);
    if (tabs.length !== 4) throw new Error(`Expected 4 vacancy tabs, found ${tabs.length}`);

    // 5. Verify D3 Funnel SVG rendered
    console.log('5. Verifying D3 Funnel chart...');
    await page.waitForSelector('.funnel-svg, .funnel-empty-state');
    const svgExists = await page.$('.funnel-svg');
    if (!svgExists) throw new Error('D3 Funnel SVG was not rendered');

    // 6. Open candidate Ilse Vandal (CAND-101)
    console.log('6. Opening candidate Ilse Vandal (CAND-101)...');
    await page.waitForSelector('.candidate-card[data-cand-id="CAND-101"]');
    await page.click('.candidate-card[data-cand-id="CAND-101"]');

    // Verify drawer opened
    await page.waitForSelector('.drawer-content', { visible: true });
    const drawerTitle = await page.$eval('.drawer-title', el => el.textContent);
    console.log(`✓ Candidate drawer opened for: ${drawerTitle}`);
    if (!drawerTitle.includes('Ilse Vandal')) {
      throw new Error(`Expected drawer for Ilse Vandal, got ${drawerTitle}`);
    }

    // Check URL hash
    const urlHash = await page.evaluate(() => window.location.hash);
    console.log(`Current URL hash: ${urlHash}`);
    if (!urlHash.includes('CAND-101')) {
      throw new Error(`Expected hash to include CAND-101, got ${urlHash}`);
    }

    // 7. Fully reload the page!
    console.log('7. Performing full page reload (page.reload())...');
    await page.reload({ waitUntil: 'networkidle0' });

    // 8. Confirm workspace and controls remain usable after reload
    console.log('8. Verifying workspace and controls after full reload...');
    await page.waitForSelector('.workspace-layout', { timeout: 5000 });
    await page.waitForSelector('.drawer-content', { visible: true, timeout: 5000 });

    const reloadedTitle = await page.$eval('.drawer-title', el => el.textContent);
    console.log(`✓ Preserved candidate drawer after reload: ${reloadedTitle}`);
    if (!reloadedTitle.includes('Ilse Vandal')) {
      throw new Error(`After reload, expected drawer for Ilse Vandal, got ${reloadedTitle}`);
    }

    // Test adding a note in the drawer
    console.log('9. Testing note addition in candidate drawer...');
    await page.type('#new-note-text', 'Candidate showed great joining skills during technical review.');
    await page.click('#submit-note-btn');

    await page.waitForFunction(() => {
      const notes = document.querySelectorAll('.note-text');
      return Array.from(notes).some(n => n.textContent.includes('technical review'));
    }, { timeout: 5000 });
    console.log('✓ Note successfully added and rendered in drawer');

    // 10. Close drawer and test theme switcher
    console.log('10. Closing drawer and testing Light/Dark theme switcher...');
    await page.click('#drawer-close-btn');
    await page.waitForSelector('.drawer-content', { hidden: true });

    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    console.log(`Initial theme: ${initialTheme}`);
    await page.click('#theme-toggle-btn');
    const toggledTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    console.log(`Toggled theme: ${toggledTheme}`);
    if (initialTheme === toggledTheme) {
      throw new Error('Theme toggle did not change data-theme attribute');
    }

    // 11. Test Batch Offers modal (Ruth)
    console.log('11. Testing Batch Offers modal...');
    await page.click('#batch-offers-btn');
    await page.waitForSelector('.modal-batch', { visible: true });

    const modalTitle = await page.$eval('#batch-modal-title', el => el.textContent);
    console.log(`✓ Batch modal opened: ${modalTitle}`);

    // Close batch modal
    await page.click('#modal-close-btn');
    await page.waitForSelector('.modal-batch', { hidden: true });

    // 12. Check empty vacancy ROLE-017
    console.log('12. Checking empty vacancy ROLE-017...');
    await page.click('.vacancy-tab-btn[data-code="ROLE-017"]');
    await page.waitForSelector('.funnel-empty-state');
    const emptyNotice = await page.$eval('.empty-state-text strong', el => el.textContent);
    console.log(`✓ Empty vacancy intentional state rendered: ${emptyNotice}`);

    // 13. Test Coordinator flow: Cal Meriden adding candidate and modifying panel
    console.log('13. Testing Coordinator login (Cal Meriden)...');
    await page.click('#logout-btn');
    await page.waitForSelector('.demo-account-btn[data-email="coord@pellmoor.test"]');
    await page.click('.demo-account-btn[data-email="coord@pellmoor.test"]');
    await page.waitForSelector('.workspace-layout', { timeout: 5000 });

    // Open Add Candidate Modal
    console.log('14. Adding a candidate via Add Candidate modal...');
    await page.click('#add-candidate-btn');
    await page.waitForSelector('#add-cand-form', { visible: true });
    await page.type('#cand-name-input', 'Morgan Vance');
    await page.click('#add-cand-submit-btn');

    // Wait for drawer of Morgan Vance to open automatically
    await page.waitForSelector('.drawer-content', { visible: true });
    const newCandTitle = await page.$eval('.drawer-title', el => el.textContent);
    console.log(`✓ New candidate created and opened: ${newCandTitle}`);
    if (!newCandTitle.includes('Morgan Vance')) {
      throw new Error(`Expected drawer for Morgan Vance, got ${newCandTitle}`);
    }

    // Add Otis Barre to Morgan Vance's panel
    console.log('15. Assigning Otis Barre to panel...');
    await page.select('#panel-member-select', 'panel1@pellmoor.test');
    await page.click('#add-panel-btn');

    await page.waitForFunction(() => {
      const names = document.querySelectorAll('.member-name');
      return Array.from(names).some(n => n.textContent.includes('Otis Barre'));
    }, { timeout: 5000 });
    console.log('✓ Otis Barre assigned to panel');

    // Add Wren Foss to Morgan Vance's panel
    console.log('16. Assigning Wren Foss to panel...');
    await page.select('#panel-member-select', 'panel2@pellmoor.test');
    await page.click('#add-panel-btn');

    await page.waitForFunction(() => {
      const names = document.querySelectorAll('.member-name');
      return Array.from(names).some(n => n.textContent.includes('Wren Foss'));
    }, { timeout: 5000 });
    console.log('✓ Wren Foss assigned to panel');

    // Close drawer
    await page.click('#drawer-close-btn');
    await page.waitForSelector('.drawer-content', { hidden: true });

    // Check fatal errors
    if (pageErrors.length > 0) {
      throw new Error(`Fatal browser errors encountered: ${pageErrors.join(', ')}`);
    }

    console.log('✓ All extended browser checks completed successfully with zero errors!');
  } finally {
    await browser.close();
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
  }
}

runBrowserTest().catch(err => {
  console.error('Browser Test Failed:', err);
  if (serverProcess) serverProcess.kill('SIGTERM');
  process.exit(1);
});
