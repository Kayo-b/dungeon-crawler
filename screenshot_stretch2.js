const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setViewportSize({ width: 800, height: 700 });

    await page.goto('http://localhost:8081');
    await page.waitForTimeout(4000);

    // Navigate to game
    await page.click('text=New Game').catch(() => {});
    await page.waitForTimeout(1500);

    const startBtn = await page.$('text=Start Adventure');
    if (startBtn) {
        await startBtn.click();
    }
    await page.waitForTimeout(2000);

    // Screenshot before toggling stretch
    await page.screenshot({ path: 'screenshot_stretch2_before.png' });
    console.log('screenshot 1: before stretch toggle');

    // Find and click the STRETCH toggle button using text selector
    let stretchFound = false;
    try {
        await page.getByText('STRETCH OFF', { exact: true }).click({ timeout: 3000 });
        stretchFound = true;
        console.log('toggled STRETCH button');
    } catch (_e) {
        // Fallback: any clickable element containing STRETCH
        const allElements = await page.$$('[role=button], div, span');
        for (const el of allElements) {
            const txt = await el.textContent().catch(() => '');
            if (txt && txt.trim() === 'STRETCH OFF') {
                await el.click();
                stretchFound = true;
                console.log('toggled via fallback');
                break;
            }
        }
    }
    if (!stretchFound) {
        console.log('STRETCH button not found - page text:');
        const body = await page.textContent('body').catch(() => '');
        console.log(body ? body.substring(0, 600) : '(empty)');
    }
    await page.waitForTimeout(800);

    // Screenshot with stretch on
    await page.screenshot({ path: 'screenshot_stretch2_on.png' });
    console.log('screenshot 2: stretch ON');

    // Move forward 5 steps to see depth change
    for (let i = 0; i < 5; i++) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'screenshot_stretch2_moved.png' });
    console.log('screenshot 3: after moving 5 steps forward');

    // Move forward 5 more to see near end
    for (let i = 0; i < 5; i++) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'screenshot_stretch2_near_end.png' });
    console.log('screenshot 4: near end of corridor');

    await browser.close();
    console.log('done');
})().catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
});
