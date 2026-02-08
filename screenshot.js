const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('http://localhost:8081');
    await page.waitForTimeout(4000);

    // Reset position first
    try {
        await page.getByText('Reset Position', { exact: true }).click();
        console.log('Reset position');
        await page.waitForTimeout(1000);
    } catch (e) {
        console.log('Reset error:', e.message);
    }

    // Take screenshot of default view (should now be 3D)
    await page.screenshot({ path: 'screenshot_default.png', fullPage: false });
    console.log('Screenshot saved: screenshot_default.png (should be 3D mode now)');

    await browser.close();
})();
