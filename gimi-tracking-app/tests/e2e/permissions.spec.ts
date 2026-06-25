import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function mockAuthAndApi(page: Page) {
    await page.addInitScript(() => {
        const fakeAuth = {
            state: {
                accessToken: 'fake-access-token',
                refreshToken: 'fake-refresh-token',
                expiresIn: 9999999999,
                userId: 'saudiextest',
                appKey: 'FAKE_KEY',
                isAuthenticated: true,
            },
            version: 0,
        };
        localStorage.setItem('gimi-auth-storage', JSON.stringify(fakeAuth));
    });

    await page.route('**/api**', async (route) => {
        const url = route.request().url();
        if (url.includes('jimi.user.device.list')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    code: 0,
                    message: 'success',
                    result: [
                        {
                            imei: '860301048898123',
                            deviceName: 'SaudiEx-Truck-01',
                            icon: 'automobile',
                            status: '1',
                            lat: 24.7136,
                            lng: 46.6753,
                            posType: 'GPS',
                            batteryPowerVal: '92',
                            gpsTime: '2026-06-06 17:00:00',
                            locDesc: 'Riyadh, Saudi Arabia'
                        }
                    ]
                })
            });
            return;
        }
        if (url.includes('jimi.user.device.location.list')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    code: 0,
                    message: 'success',
                    result: [
                        {
                            imei: '860301048898123',
                            lat: 24.7136,
                            lng: 46.6753,
                            posType: 'GPS',
                            batteryPowerVal: '92',
                            gpsTime: '2026-06-06 17:00:00',
                            locDesc: 'Riyadh, Saudi Arabia'
                        }
                    ]
                })
            });
            return;
        }
        if (url.includes('jimi.open.platform.fence.list')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ code: 0, message: 'success', result: [] })
            });
            return;
        }
        if (url.includes('jimi.user.child.create')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ code: 0, message: 'success', result: { account_id: 'playwright_operator' } })
            });
            return;
        }
        if (url.includes('jimi.device.track.mileage')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ code: 0, message: 'success', result: [{ mileage: 125500 }] })
            });
            return;
        }
        if (url.includes('jimi.device.alarm.list')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ code: 0, message: 'success', result: [] })
            });
            return;
        }
        if (url.includes('jimi.open.device.fence.list')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ code: 0, message: 'success', result: [] })
            });
            return;
        }
        if (url.includes('jimi.device.track.list')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ code: 0, message: 'success', result: [] })
            });
            return;
        }
        if (url.includes('jimi.device.location.get')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ code: 0, message: 'success', result: {} })
            });
            return;
        }
        if (url.includes('jimi.user.child.list')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ code: 0, message: 'success', result: [] })
            });
            return;
        }
        await route.continue();
    });
}

test.describe('Users & Permissions Gating and Audit Logs', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
        page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
        await mockAuthAndApi(page);
    });

    test('should manage sub-accounts, toggle simulated operator role, block device rename and record audit logs', async ({ page }) => {
        // Go to settings page and clear simulation storage before we begin
        await page.goto('/settings');
        await page.evaluate(() => localStorage.removeItem('gimi-simulation-storage'));
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Click on Users & Permissions button
        await page.getByText(/المستخدمون والصلاحيات|Users & Permissions/).first().click();

        // 1. Check Sub-Accounts header and logs
        await expect(page.locator('h1')).toContainText('Users & Permissions');
        await expect(page.getByRole('heading', { name: 'Sub-Accounts' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Activity & Audit Log' })).toBeVisible();

        // 2. Add a sub-account using the form
        await page.getByRole('button', { name: 'Add Account' }).click();
        await page.getByLabel('Account Username *').fill('playwright_operator');
        await page.getByLabel('Display Name *').fill('Playwright Test User');
        await page.getByLabel('Password *').fill('password123');
        await page.getByLabel('Email Address *').fill('test@playwright.com');
        await page.getByRole('button', { name: 'Save Account' }).click();

        // Verify sub-account is created and added to list
        await expect(page.getByText('Playwright Test User')).toBeVisible();
        await expect(page.getByText('ID: playwright_operator')).toBeVisible();

        // Verify sub-account creation activity log is registered
        await expect(page.locator('tr').filter({ hasText: 'Created sub-account: playwright_operator' })).toBeVisible();

        // Register a global dialog handler to automatically handle prompts and alerts
        page.on('dialog', async (dialog) => {
            if (dialog.type() === 'prompt') {
                await dialog.accept('SaudiEx-Truck-01-Renamed');
            } else {
                await dialog.dismiss();
            }
        });

        // 3. Toggle Role Simulation to Sub-Account Operator
        await page.locator('input[type="checkbox"]').click({ force: true });
        await expect(page.getByText('Active Role:')).toContainText('Sub-Account Operator (Read-Only)');

        // 4. Try to add another subaccount (should be blocked)
        await page.getByRole('button', { name: 'Add Account' }).click();

        // 5. Navigate to Home/Dashboard Map and test Device renaming block
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Hover or click to open Device Item options menu
        await page.locator('button:has-text("SaudiEx-Truck-01")').click();

        await page.locator('button:has-text("SaudiEx-Truck-01")').locator('svg').nth(1).click(); // Open actions menu

        // Click "Rename device"
        await page.getByText('Rename device').click();
        
        // Wait for prompt and alert dialog events to be processed
        await page.waitForTimeout(1500);

        // 6. Go back to settings -> Users & Permissions and check the logged activity
        await page.goto('/settings');
        await page.waitForLoadState('networkidle');
        await page.getByText(/المستخدمون والصلاحيات|Users & Permissions/).first().click();

        // The logs table should now show a failed rename attempt log
        const failedRenameRow = page.locator('tr').filter({ hasText: 'Rename Device' }).filter({ hasText: 'Failed' });
        await expect(failedRenameRow).toBeVisible();
        await expect(failedRenameRow).toContainText('Permission Denied');
    });
});
