import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function mockAuth(page: Page) {
    await page.addInitScript(() => {
        const fakeAuth = {
            state: {
                accessToken: 'fake-access-token',
                refreshToken: 'fake-refresh-token',
                expiresIn: 9999999999,
                userId: 'test_user',
                appKey: 'FAKE_KEY',
                isAuthenticated: true,
            },
            version: 0,
        };
        localStorage.setItem('gimi-auth-storage', JSON.stringify(fakeAuth));
    });
}

test.describe('Share Management', () => {
    test.beforeEach(async ({ page }) => {
        await mockAuth(page);
        await page.goto('/share-manage');
        await page.waitForLoadState('load');
    });

    test('renders Share page header', async ({ page }) => {
        // If it redirects to login, this will fail
        await expect(page).not.toHaveURL(/\/login/);
        const header = page.locator('h1').filter({ hasText: /Share|مشاركة/i }).first();
        await expect(header).toBeVisible({ timeout: 10000 });
    });

    test.fixme('can generate a share link', async () => {
        // Brittle due to API mocking requirements
    });
});

test.describe('View Share Page', () => {
    test('shows invalid link error for empty params', async ({ page }) => {
        await page.goto('/share');
        await page.waitForLoadState('load');
        // It should show some error state
        await expect(page.locator('body')).toContainText(/Invalid|Inactive|غير صحيح|معطل/i);
    });

    test('renders shared live map and shows Ring Tag button', async ({ page }) => {
        // Mock the Gimi API location response
        await page.route('**/api**', async (route) => {
            const url = route.request().url();
            if (url.includes('jimi.device.location.get')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        code: 0,
                        message: 'success',
                        result: [
                            {
                                imei: '123456789012345',
                                lat: 24.7136,
                                lng: 46.6753,
                                speed: '45',
                                status: '1',
                                gpsTime: '2026-06-05 12:00:00'
                            }
                        ]
                    })
                });
            } else {
                await route.fallback();
            }
        });

        // Navigate using the precalculated valid signature for: 123456789012345|4087132800|testtoken
        await page.goto('/share?imei=123456789012345&name=TestDevice&exp=4087132800&tok=testtoken&sig=d85e9c0709903c40655ba21f5ba300a54c6dc18df2a93c1e48b51876ccf1a3c0');
        await page.waitForLoadState('networkidle');

        // Verify that Ring Tag button is visible
        const ringBtn = page.locator('button', { hasText: /Ring Tag|رنين الجهاز/i }).first();
        await expect(ringBtn).toBeVisible({ timeout: 10000 });
    });

    test('can trigger Ring Tag command successfully', async ({ page }) => {
        let commandSent = false;

        // Mock the Gimi API calls
        await page.route('**/api**', async (route) => {
            const url = route.request().url();
            if (url.includes('jimi.device.location.get')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        code: 0,
                        message: 'success',
                        result: [
                            {
                                imei: '123456789012345',
                                lat: 24.7136,
                                lng: 46.6753,
                                speed: '45',
                                status: '1',
                                gpsTime: '2026-06-05 12:00:00'
                            }
                        ]
                    })
                });
            } else if (url.includes('jimi.open.instruction.send')) {
                const requestData = route.request().url();
                expect(requestData).toContain('inst_param_json=');
                expect(requestData).toContain('FIND%2C3000%23'); // FIND,3000# inside JSON
                expect(requestData).toContain('imei=123456789012345');
                expect(requestData).toContain('access_token=testtoken');
                commandSent = true;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        code: 0,
                        message: 'success'
                    })
                });
            } else {
                await route.fallback();
            }
        });

        // Set up the dialog/alert handler
        let dialogMessage = '';
        page.on('dialog', async (dialog) => {
            dialogMessage = dialog.message();
            await dialog.accept();
        });

        // Navigate using the precalculated valid signature
        await page.goto('/share?imei=123456789012345&name=TestDevice&exp=4087132800&tok=testtoken&sig=d85e9c0709903c40655ba21f5ba300a54c6dc18df2a93c1e48b51876ccf1a3c0');
        await page.waitForLoadState('networkidle');

        // Click the Ring Tag button
        const ringBtn = page.locator('button', { hasText: /Ring Tag|رنين الجهاز/i }).first();
        await expect(ringBtn).toBeVisible();
        await ringBtn.click();

        // Verify the command was sent and the success message was alerted
        await expect.poll(() => commandSent).toBe(true);
        await expect.poll(() => dialogMessage).toContain('TestDevice');
    });
});

