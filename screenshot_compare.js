const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('http://localhost:8081');
    await page.waitForTimeout(4000);
    await page.getByText('New Game', { exact: true }).click();
    await page.waitForTimeout(2000);
    await page.getByText('Start Adventure', { exact: true }).click();
    await page.waitForTimeout(3000);

    // Screenshot with default Room3D (STRETCH OFF)
    await page.screenshot({ path: 'screenshot_room3d_ref.png' });
    console.log('Room3D reference saved');

    // Toggle stretch ON
    await page.getByText('STRETCH OFF', { exact: true }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'screenshot_stretch_current.png' });
    console.log('Stretch current saved');

    await browser.close();
})();
