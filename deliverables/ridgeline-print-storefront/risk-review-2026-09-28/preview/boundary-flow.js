async (page) => {
  await page.goto('http://localhost:3000');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.print-card').first().waitFor();
  const title = await page.title();
  const prints = await page.locator('.print-card h2').allTextContents();
  await page.screenshot({ path: '/work/ridgeline-preview.png', fullPage: true });
  await page.getByRole('button', { name: 'View Long Field', exact: true }).click();
  const detail = await page.getByRole('heading', { name: 'Long Field', exact: true }).isVisible();
  return { passed: prints.length === 8 && detail, title, prints, detailOpened: detail, scope: 'Live preview only; no orders placed or judge evaluation.' };
}
