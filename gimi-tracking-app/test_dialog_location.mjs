import { chromium } from '@playwright/test';

async function main() {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log('Navigating to TrackSolid Pro...');
    await page.goto('https://www.tracksolidpro.com/', { waitUntil: 'networkidle' });

    console.log('Filling login form...');
    await page.fill('input[placeholder="Account"]', 'saudiextest');
    await page.fill('input[placeholder="Password"]', 'saudiex123');

    console.log('Clicking Login button...');
    await page.click('button:has-text("Login")');

    console.log('Waiting for monitor dashboard...');
    await page.waitForTimeout(7000);

    const targetFrame = page.frames().find(f => f.url().includes('monitorObject') || f.url().includes('tracksolidpro'));
    if (!targetFrame) {
        console.error('Target iframe not found!');
        await browser.close();
        return;
    }

    console.log('Clicking Account tab...');
    await targetFrame.click('li:has-text("Account")');

    console.log('Waiting for New Account button...');
    await targetFrame.waitForSelector('button:has-text("New Account")', { timeout: 10000 });
    
    console.log('Clicking New Account button...');
    await targetFrame.click('button:has-text("New Account")');
    await page.waitForTimeout(3000); // Wait for animation

    console.log('Checking dialog location...');
    const inMain = await page.evaluate(() => document.querySelector('.el-dialog') !== null);
    const inFrame = await targetFrame.evaluate(() => document.querySelector('.el-dialog') !== null);
    
    console.log(`Is .el-dialog in main page? ${inMain}`);
    console.log(`Is .el-dialog in target iframe? ${inFrame}`);

    // Let's print the outer HTML of the first element that looks like a dialog in both
    const mainDialogHtml = await page.evaluate(() => {
        const el = document.querySelector('[class*="dialog"], [class*="modal"]');
        return el ? el.outerHTML.substring(0, 300) : 'None';
    });
    console.log(`Main page dialog element: ${mainDialogHtml}`);

    const frameDialogHtml = await targetFrame.evaluate(() => {
        const el = document.querySelector('[class*="dialog"], [class*="modal"]');
        return el ? el.outerHTML.substring(0, 300) : 'None';
    });
    console.log(`Iframe dialog element: ${frameDialogHtml}`);

    await page.screenshot({ path: './dialog_location_check.png' });
    console.log('Screenshot saved to dialog_location_check.png');

    await browser.close();
}

main().catch(console.error);
