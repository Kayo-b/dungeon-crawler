import { chromium } from 'playwright';

const outDir = 'output/playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const continueBtn = page.getByText('Continue Game', { exact: true });
if (await continueBtn.count()) {
  await continueBtn.click();
  await page.waitForTimeout(1000);
}

await page.screenshot({ path: `${outDir}/13_before_turns.png`, fullPage: true });

for (let i = 0; i < 3; i++) {
  await page.getByText('Right', { exact: true }).click();
  await page.waitForTimeout(300);
}

await page.screenshot({ path: `${outDir}/14_after_turns.png`, fullPage: true });

const bodyText1 = await page.locator('body').innerText();
console.log('HAS_ENEMY_LIFE_TEXT_AFTER_TURN:', bodyText1.includes('Life:'));

const lifeLoc = page.locator('text=/Life:/');
const lifeCount = await lifeLoc.count();
console.log('LIFE_COUNT:', lifeCount);
if (lifeCount > 0) {
  await lifeLoc.first().click();
  await page.waitForTimeout(1200);
}

await page.screenshot({ path: `${outDir}/15_after_enemy_engage.png`, fullPage: true });

const specialLoc = page.locator('text=/Fire Blast|Crushing Blow|Mutilate/').first();
if (await specialLoc.count()) {
  await specialLoc.click();
  await page.waitForTimeout(900);
}

await page.screenshot({ path: `${outDir}/16_after_special_try.png`, fullPage: true });
const bodyText2 = await page.locator('body').innerText();
console.log('HAS_NEED_COMBAT:', bodyText2.includes('Need Combat'));
console.log('HAS_COOLDOWN:', /\(\d+\)/.test(bodyText2));
console.log('HAS_DAMAGE_WORD:', /damage|missed|hit/i.test(bodyText2));

await browser.close();
