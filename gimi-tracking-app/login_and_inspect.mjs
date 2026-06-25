import { chromium } from '@playwright/test';
import fs from 'fs';

async function main() {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    console.log('Navigating to TrackSolid Pro...');
    await page.goto('https://www.tracksolidpro.com/', { waitUntil: 'networkidle' });

    console.log('Filling login form...');
    await page.fill('input[placeholder="Account"]', 'saudiextest');
    await page.fill('input[placeholder="Password"]', 'saudiex123');

    console.log('Clicking Login button...');
    await page.click('button:has-text("Login")');

    console.log('Waiting for monitor dashboard...');
    await page.waitForSelector('li:has-text("Account")', { timeout: 15000 });

    console.log('Clicking Account navbar item...');
    await page.click('li:has-text("Account")');

    console.log('Waiting for Account page load...');
    await page.waitForSelector('button:has-text("New Account")', { timeout: 10000 });

    console.log('Clicking New Account button...');
    await page.click('button:has-text("New Account")');

    console.log('Waiting for dialog...');
    await page.waitForTimeout(3000);

    console.log('Taking screenshot...');
    await page.screenshot({ path: './new_account_dialog.png' });
    console.log('Screenshot saved to gimi-tracking-app/new_account_dialog.png');

    // Print input labels and placeholders inside the dialog
    const inputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.el-dialog input, .el-dialog label, .el-dialog span')).map(el => {
            return {
                tagName: el.tagName,
                text: el.textContent ? el.textContent.trim() : '',
                placeholder: el.getAttribute('placeholder') || ''
            };
        }).filter(item => item.text.length > 0 || item.placeholder.length > 0);
    });

    console.log('Form elements:');
    console.log(inputs);

    await browser.close();
}

main().catch(console.error);
