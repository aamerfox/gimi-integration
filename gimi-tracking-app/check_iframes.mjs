import { chromium } from '@playwright/test';

async function main() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://www.tracksolidpro.com/', { waitUntil: 'networkidle' });
    
    // Login
    await page.fill('input[placeholder="Account"]', 'saudiextest');
    await page.fill('input[placeholder="Password"]', 'saudiex123');
    await page.click('button:has-text("Login")');
    await page.waitForTimeout(5000);
    
    // Get all frames
    const frames = page.frames();
    console.log(`Number of frames: ${frames.length}`);
    frames.forEach((f, idx) => {
        console.log(`Frame ${idx}: Name = "${f.name()}", URL = "${f.url()}"`);
    });

    await browser.close();
}

main().catch(console.error);
