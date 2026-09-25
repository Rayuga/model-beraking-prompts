# Browser runtime

Chromium and its required Linux libraries are already installed. The browser
executable is `/usr/local/bin/chromium`. The pinned Playwright runtime belongs
to the globally installed `@playwright/mcp@0.0.79` package; import it from
`/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright`.
No package installation, browser download, or additional permission is needed
to use this runtime to check your local app.

Start your shipped server from `/app`. Save your browser check as a CommonJS
script, such as `/tmp/check-workspace.cjs`, and run it with
`node /tmp/check-workspace.cjs`. The following opens the local app and records
browser errors; extend it with your app's actual controls for sign-in, vacancy
and candidate navigation, and a full reload before asserting the final result.

```javascript
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/local/bin/chromium',
    headless: true,
    args: ['--no-sandbox']
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
    console.log(JSON.stringify({ title: await page.title(), errors }, null, 2));
    if (errors.length) throw new Error(errors.join('\n'));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
```

Opening the initial page alone does not complete the check. Exercise the
populated signed-in workspace, inspect the requested script and style response
bodies and content types, open a candidate, and verify the workspace after a
full reload. Fix browser failures and repeat the complete check after your
last code change. Keep diagnostic scripts outside the product's served files.
