import { chromium } from 'playwright';
import fs from 'fs/promises';

const outDir = 'output/playwright';
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

const shot = async (name) => page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });

await page.goto('http://localhost:8081', { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(1200);
await shot('20_start_menu');

await page.getByText('New Game', { exact: true }).click();
await page.waitForTimeout(350);
await shot('21_character_creation');

await page.getByPlaceholder('Character name').fill('QA Caster');
await page.getByText('Magic Caster').click();
await page.getByText('Start Adventure').click();
await page.waitForTimeout(1800);
await shot('22_game_loaded');

// Inventory open/close checks
const closeBtns = page.getByText('Close');
if (await closeBtns.count()) {
  const c = await closeBtns.count();
  for (let i = 0; i < c; i++) {
    await closeBtns.nth(0).click();
    await page.waitForTimeout(200);
  }
}
await shot('23_inventory_closed');

const openBtns = page.getByText('Open');
if (await openBtns.count()) {
  const c = await openBtns.count();
  for (let i = 0; i < c; i++) {
    await openBtns.nth(0).click();
    await page.waitForTimeout(200);
  }
}
await shot('24_inventory_opened');

// Rotate to find enemy visibility
let lifeCount = await page.locator('text=/Life:/').count();
console.log('LIFE_COUNT_INITIAL:', lifeCount);
for (let i = 0; i < 4 && lifeCount === 0; i++) {
  const right = page.getByText('Right', { exact: true });
  if (await right.count()) {
    await right.click();
    await page.waitForTimeout(450);
    lifeCount = await page.locator('text=/Life:/').count();
    console.log(`LIFE_COUNT_AFTER_TURN_${i + 1}:`, lifeCount);
  }
}

await shot('25_after_turning');

if (lifeCount > 0) {
  await page.locator('text=/Life:/').first().click();
  await page.waitForTimeout(1300);
}
await shot('26_after_enemy_click');

const special = page.locator('text=/Fire Blast|Crushing Blow|Mutilate/').first();
if (await special.count()) {
  await special.click();
  await page.waitForTimeout(1000);
}
await shot('27_after_special');

const text = await page.locator('body').innerText();
console.log('HAS_PERSISTENT_LOG_LABEL:', text.includes('Combat Log (Persistent)'));
console.log('HAS_CLASS_LABEL:', /Caster|Warrior|Ranger/.test(text));
console.log('HAS_SPECIAL_BUTTON_TEXT:', /Fire Blast|Crushing Blow|Mutilate|Need Combat/.test(text));
console.log('HAS_COMBAT_EVENTS_TEXT:', /damage|missed|hit|Combat ended/i.test(text));

await browser.close();
console.log('E2E_DONE');
