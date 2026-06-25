import { chromium } from '@playwright/test';
import fs from 'fs';

async function main() {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log('Navigating to local dev server login page...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });

    console.log('Filling custom credentials for hertz...');
    await page.fill('input[placeholder="Enter your account ID"]', 'hertz');
    await page.fill('input[placeholder="Enter your password"]', 'hertz08642');

    console.log('Taking screenshot of login form...');
    await page.screenshot({ path: './scratch/hertz_login_filled.png' });
    console.log('Screenshot saved to scratch/hertz_login_filled.png');

    console.log('Submitting login...');
    await page.click('button:has-text("Sign In")');

    console.log('Waiting for Dashboard to load...');
    await page.waitForTimeout(6000); // Wait for initial loading to complete

    console.log('Taking screenshot of Dashboard...');
    await page.screenshot({ path: './scratch/hertz_dashboard_loaded.png' });
    console.log('Screenshot saved to scratch/hertz_dashboard_loaded.png');

    // Retrieve body text or page elements to inspect device name
    const bodyText = await page.evaluate(() => document.body.textContent || '');
    console.log(`Page body length: ${bodyText.length}`);

    const devItems = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('*')).map(el => el.textContent?.trim() || '')
            .filter(text => text.includes('781950640051748') || text.includes('Hertz Device'));
    });
    console.log('Device elements containing matching strings:', devItems.slice(0, 5));

    console.log('Logging out to verify parent account list shows hertz child account...');
    // We can go to settings directly
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
    
    // Log in as saudiextest
    console.log('Logging in as parent saudiextest...');
    await page.fill('input[placeholder="Enter your account ID"]', 'saudiextest');
    await page.fill('input[placeholder="Enter your password"]', 'saudiex123');
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(6000);

    console.log('Navigating to settings...');
    // Click Settings or go directly to route
    await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('Clicking Users & Permissions...');
    await page.click('button:has-text("Users & Permissions")');
    await page.waitForTimeout(3000);

    console.log('Taking screenshot of sub-accounts list...');
    await page.screenshot({ path: './scratch/saudiextest_settings_subaccounts.png' });
    console.log('Screenshot saved to scratch/saudiextest_settings_subaccounts.png');

    await browser.close();
}

main().catch(console.error);
