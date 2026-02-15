import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.getByText('New Game', { exact: true }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder('Character name').fill('Cooldown QA');
await page.getByText('Magic Caster').click();
await page.getByText('Start Adventure').click();
await page.waitForTimeout(1600);
await page.getByText('Right', { exact: true }).click();
await page.waitForTimeout(600);

const life = page.locator('text=/Life:/').first();
if (await life.count()) {
  await life.click();
}
await page.waitForTimeout(700);

const fire = page.getByText('Fire Blast', { exact: true });
if (await fire.count()) {
  await fire.click();
  await page.waitForTimeout(350);
}
await page.screenshot({ path: 'output/playwright/28_after_fire_blast_click.png', fullPage: true });

const txt = await page.locator('body').innerText();
console.log('HAS_COOLDOWN_TEXT_NOW:', /Fire Blast \(\d+\)/.test(txt));
console.log('HAS_FIREBLAST_LOG:', /Fire Blast hit/.test(txt));

await browser.close();
