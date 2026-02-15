import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto('http://localhost:8082', { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(700);

// Ensure save exists
const hasContinue = await page.getByText('Continue Game', { exact: true }).count();
if (!hasContinue) {
  await page.getByText('New Game', { exact: true }).click();
  await page.getByPlaceholder('Character name').fill('Death QA');
  await page.getByText('Magic Caster').click();
  await page.getByText('Start Adventure').click();
  await page.waitForTimeout(1200);
}

// Force low HP in saved data.
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
  await page.waitForTimeout(1100);
}

await page.screenshot({ path: 'output/playwright/29_before_death_test.png', fullPage: true });

// Face enemies and start combat
const rightBtn = page.getByText('Right', { exact: true });
if (await rightBtn.count()) {
  await rightBtn.click();
  await page.waitForTimeout(500);
}

const life = page.locator('text=/Life:/').first();
if (await life.count()) {
  await life.click();
}
await page.waitForTimeout(500);

let died = false;
for (let i = 0; i < 30; i++) {
  const txt = await page.locator('body').innerText();
  if (txt.includes('YOU DIED')) {
    died = true;
    break;
  }
  await page.waitForTimeout(500);
}

await page.screenshot({ path: 'output/playwright/30_death_overlay.png', fullPage: true });
console.log('DEATH_OVERLAY_VISIBLE:', died);

if (died && await page.getByText('Restart', { exact: true }).count()) {
  await page.getByText('Restart', { exact: true }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'output/playwright/31_after_restart.png', fullPage: true });
}

const endText = await page.locator('body').innerText();
console.log('RESTART_BUTTON_PRESENT_AFTER_CLICK:', endText.includes('Restart'));
console.log('HAS_YOU_DIED_AFTER_RESTART:', endText.includes('YOU DIED'));

await browser.close();
