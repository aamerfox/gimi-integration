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

    console.log('Waiting for monitor dashboard and iframe...');
    await page.waitForTimeout(7000); // Wait for page to stabilize and iframe to load

    // Print all frames to find the one we need
    const frames = page.frames();
    console.log(`Available frames: ${frames.length}`);
    let targetFrame = null;
    for (const f of frames) {
        console.log(`  - URL: ${f.url()}`);
        if (f.url().includes('monitorObject') || f.url().includes('tracksolidpro')) {
            targetFrame = f;
        }
    }

    if (!targetFrame) {
        console.error('Target iframe not found!');
        await browser.close();
        return;
    }

    console.log('Found target iframe!');

    // Wait for the navigation menu inside the iframe
    // Let's print some text from the iframe to verify it's loaded
    const bodyText = await targetFrame.evaluate(() => document.body.textContent || '');
    console.log(`Iframe body text length: ${bodyText.length}`);

    // Click "Account" tab inside the iframe
    console.log('Clicking Account tab inside iframe...');
    // We can click the Account element. Let's find it. It's usually a menu item.
    // In our previous script, we used: 'li:has-text("Account")'
    await targetFrame.click('li:has-text("Account")');
    console.log('Clicked Account tab.');

    // Wait for "New Account" button inside the iframe
    console.log('Waiting for New Account button inside iframe...');
    await targetFrame.waitForSelector('button:has-text("New Account")', { timeout: 10000 });
    
    console.log('Clicking New Account button...');
    await targetFrame.click('button:has-text("New Account")');

    // Wait for the dialog to open inside the iframe
    console.log('Waiting for New Account dialog...');
    await targetFrame.waitForSelector('.el-dialog', { timeout: 10000 });
    console.log('Dialog found! Taking screenshot...');

    await page.screenshot({ path: './new_account_dialog_iframe.png' });
    console.log('Screenshot saved to new_account_dialog_iframe.png');

    // Print form elements inside the dialog
    const inputs = await targetFrame.evaluate(() => {
        return Array.from(document.querySelectorAll('.el-dialog input, .el-dialog label, .el-dialog span')).map(el => {
            return {
                tagName: el.tagName,
                text: el.textContent ? el.textContent.trim() : '',
                placeholder: el.getAttribute('placeholder') || ''
            };
        }).filter(item => item.text.length > 0 || item.placeholder.length > 0);
    });

    console.log('Dialog form elements:');
    console.log(inputs);

    await browser.close();
}

main().catch(console.error);
