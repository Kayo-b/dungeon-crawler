import { chromium } from 'playwright';
import fs from 'fs/promises';

const outDir = 'output/playwright';
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

const step = async (name, fn) => {
  try {
    console.log(`STEP: ${name}`);
    await fn();
  } catch (err) {
    console.log(`STEP_FAIL: ${name} -> ${err.message}`);
  }
};

await page.goto('http://localhost:8081', { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(1200);

await step('start_menu_screenshot', async () => {
  await page.screenshot({ path: `${outDir}/01_start_menu.png`, fullPage: true });
});

await step('new_game_open', async () => {
  await page.getByText('New Game', { exact: true }).click({ timeout: 5000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/02_character_creation.png`, fullPage: true });
});

await step('create_character', async () => {
  const input = page.getByPlaceholder('Character name');
  await input.fill('Playwright Hero');
  await page.getByText('Magic Caster').click();
  await page.getByText('Start Adventure').click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${outDir}/03_game_loaded.png`, fullPage: true });
});

await step('toggle_inventory_sections', async () => {
  const closeButtons = page.getByText('Close');
  const total = await closeButtons.count();
  if (total > 0) {
    await closeButtons.nth(0).click();
  }
  if (total > 1) {
    await closeButtons.nth(1).click();
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/04_inventory_closed.png`, fullPage: true });

  const openButtons = page.getByText('Open');
  const openCount = await openButtons.count();
  if (openCount > 0) await openButtons.nth(0).click();
  if (openCount > 1) await openButtons.nth(1).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/05_inventory_open.png`, fullPage: true });
});

await step('combat_engage', async () => {
  await page.mouse.click(700, 330);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${outDir}/06_after_combat_click.png`, fullPage: true });
});

await step('special_attack_trigger', async () => {
  const specialBtn = page.locator('text=Fire Blast').first();
  if (await specialBtn.count()) {
    await specialBtn.click();
    await page.waitForTimeout(700);
  } else {
    const anySpecial = page.locator('text=Crushing Blow').or(page.locator('text=Mutilate')).first();
    if (await anySpecial.count()) {
      await anySpecial.click();
      await page.waitForTimeout(700);
    }
  }
  await page.screenshot({ path: `${outDir}/07_special_attack.png`, fullPage: true });
});

await step('read_combat_log', async () => {
  const texts = await page.locator('text=Combat Log').allTextContents();
  const logLines = await page.locator('text=/damage|missed|Combat ended|hit/i').allTextContents();
  console.log('LOG_HEADER_FOUND:', texts.length > 0);
  console.log('LOG_LINE_SAMPLE:', logLines.slice(0, 8));
});

await step('reload_and_continue', async () => {
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}/08_reloaded_menu_or_game.png`, fullPage: true });
  const continueBtn = page.getByText('Continue Game', { exact: true });
  if (await continueBtn.count()) {
    await continueBtn.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${outDir}/09_continue_game.png`, fullPage: true });
  }
});

await browser.close();
console.log('DONE_UI_CHECK');
