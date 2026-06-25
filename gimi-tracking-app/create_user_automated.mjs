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
    await page.waitForTimeout(2000);

    // Click Account Type dropdown
    console.log('Selecting Account Type...');
    await page.click('.el-form-item:has-text("Account Type") .el-select');
    await page.waitForTimeout(1000);
    // Let's print visible options
    const options = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.el-select-dropdown__item')).map(el => el.textContent ? el.textContent.trim() : '');
    });
    console.log('Available Account Type options:', options);

    // Select "End User"
    await page.click('.el-select-dropdown__item:has-text("End User")');
    await page.waitForTimeout(1000);

    console.log('Entering Customer Name...');
    await page.fill('input[placeholder="Enter Customer Name"]', 'Wahba Ibrahim');

    console.log('Entering Login Account...');
    await page.fill('input[placeholder="Enter Login Account"]', 'wahba.ibrahim@alrashidi-kts.com');

    console.log('Entering password...');
    // Find password input
    await page.fill('.el-form-item:has-text("password") input[type="password"]', 'wahba123');

    console.log('Entering Email...');
    await page.fill('input[placeholder="Enter Email"]', 'wahba.ibrahim@alrashidi-kts.com');

    // Select Country / Region
    console.log('Selecting Country...');
    await page.click('.el-form-item:has-text("Country") .el-select');
    await page.waitForTimeout(1000);
    
    // Type to search or filter Saudi Arabia
    await page.fill('.el-form-item:has-text("Country") input', 'Saudi Arabia');
    await page.waitForTimeout(1000);
    
    // Click Saudi Arabia from dropdown
    await page.click('.el-select-dropdown__item:has-text("Saudi Arabia")');
    await page.waitForTimeout(1000);

    console.log('Taking screenshot before submitting...');
    await page.screenshot({ path: './filled_form.png' });
    console.log('Screenshot saved to gimi-tracking-app/filled_form.png');

    console.log('Clicking Confirm button...');
    await page.click('button:has-text("Confirm")');

    console.log('Waiting for response...');
    await page.waitForTimeout(5000);

    console.log('Taking screenshot after submitting...');
    await page.screenshot({ path: './after_submit.png' });
    console.log('Screenshot saved to gimi-tracking-app/after_submit.png');

    const bodyText = await page.evaluate(() => document.body.textContent || '');
    console.log('Page contains error/success messages?');
    // Look for toast or message dialog
    const messageBox = await page.evaluate(() => {
        const msgEl = document.querySelector('.el-message, .el-message-box, .el-notification');
        return msgEl ? msgEl.textContent : 'None found';
    });
    console.log('Message Box text:', messageBox);

    await browser.close();
}

main().catch(console.error);
