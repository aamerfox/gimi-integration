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
    await page.goto('https://www.tracksolidpro.com/', { waitUntil: 'load', timeout: 30000 });
    
    console.log('Current URL:', page.url());
    console.log('Waiting for load...');
    await page.waitForTimeout(5000);
    console.log('URL after wait:', page.url());

    console.log('Taking screenshot...');
    await page.screenshot({ path: './check_portal.png' });
    console.log('Screenshot saved to gimi-tracking-app/check_portal.png');

    // Print some of the page HTML or elements
    console.log('Page title:', await page.title());
    
    await browser.close();
}

main().catch(console.error);
