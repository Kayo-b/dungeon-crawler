import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE_ERROR', m.text());
});

await page.goto('http://localhost:8082', { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(700);

// Always create a save deterministically
if (await page.getByText('New Game', { exact: true }).count()) {
  await page.getByText('New Game', { exact: true }).click();
  await page.getByPlaceholder('Character name').fill('Restart QA');
  await page.getByText('Magic Caster').click();
  await page.getByText('Start Adventure').click();
  await page.waitForTimeout(1200);
}

await page.evaluate(() => {
  const raw = localStorage.getItem('characters');
  if (!raw) return;
  const obj = JSON.parse(raw);
  obj.character.stats.health = 1;
  localStorage.setItem('characters', JSON.stringify(obj));
});

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
if (await page.getByText('Continue Game', { exact: true }).count()) {
  await page.getByText('Continue Game', { exact: true }).click();
  await page.waitForTimeout(1200);
}

// face and engage
if (await page.getByText('Right', { exact: true }).count()) {
  await page.getByText('Right', { exact: true }).click();
  await page.waitForTimeout(500);
}
if (await page.locator('text=/Life:/').count()) {
  await page.locator('text=/Life:/').first().click();
}

for (let i = 0; i < 35; i++) {
  const txt = await page.locator('body').innerText();
  if (txt.includes('YOU DIED')) break;
  await page.waitForTimeout(300);
}

await page.screenshot({ path: 'output/playwright/34_before_restart_click.png', fullPage: true });

const restartCount = await page.getByText('Restart', { exact: true }).count();
console.log('RESTART_COUNT', restartCount);
if (restartCount > 0) {
  await page.getByText('Restart', { exact: true }).click();
  await page.waitForTimeout(2200);
}

const post = await page.locator('body').innerText();
const hp = await page.evaluate(() => {
  const raw = localStorage.getItem('characters');
  if (!raw) return null;
  return JSON.parse(raw).character.stats.health;
});
console.log('POST_HAS_DIED', post.includes('YOU DIED'));
console.log('POST_HP_TEXT_MATCH', (post.match(/HP\s*-?\d+/) || [])[0]);
console.log('SAVED_HP_AFTER_RESTART', hp);

await page.screenshot({ path: 'output/playwright/35_after_restart_click.png', fullPage: true });
await browser.close();
