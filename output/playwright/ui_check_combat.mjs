import { chromium } from 'playwright';
import fs from 'fs/promises';

const outDir = 'output/playwright';
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto('http://localhost:8081', { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(1000);

const continueBtn = page.getByText('Continue Game', { exact: true });
if (await continueBtn.count()) {
  await continueBtn.click();
  await page.waitForTimeout(1200);
}

await page.screenshot({ path: `${outDir}/10_continue_loaded.png`, fullPage: true });

const lifeTexts = page.locator('text=/Life:/');
const lifeCount = await lifeTexts.count();
console.log('ENEMY_LIFE_LABELS:', lifeCount);

if (lifeCount > 0) {
  await lifeTexts.first().click();
  await page.waitForTimeout(1200);
}

await page.screenshot({ path: `${outDir}/11_after_enemy_click.png`, fullPage: true });

const specialCandidates = [
  page.locator('text=/Fire Blast/').first(),
  page.locator('text=/Crushing Blow/').first(),
  page.locator('text=/Mutilate/').first(),
];

let specialClicked = false;
for (const btn of specialCandidates) {
  if (await btn.count()) {
    await btn.click();
    specialClicked = true;
    break;
  }
}

await page.waitForTimeout(1200);
await page.screenshot({ path: `${outDir}/12_after_special.png`, fullPage: true });

const allText = await page.locator('body').innerText();
const hasCombatLog = allText.includes('Combat Log');
const hasCooldownText = /\(\d+\)/.test(allText);
const hasNeedCombat = allText.includes('Need Combat');

console.log('SPECIAL_CLICKED:', specialClicked);
console.log('HAS_COMBAT_LOG:', hasCombatLog);
console.log('HAS_COOLDOWN_PATTERN:', hasCooldownText);
console.log('HAS_NEED_COMBAT_LABEL:', hasNeedCombat);

await browser.close();
