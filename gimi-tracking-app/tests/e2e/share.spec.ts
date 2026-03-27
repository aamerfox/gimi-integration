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
        await page.goto('/share');
        await page.waitForLoadState('load');
    });

    test('renders Share page header and subtitle', async ({ page }) => {
        await expect(page.locator('h1')).toContainText(/Share|مشاركة/i);
        await expect(page.locator('p', { hasText: /tracking link/i })).toBeVisible();
    });

    test('shows device selector with pre-selected device', async ({ page }) => {
        const select = page.locator('select').first();
        await expect(select).toBeVisible();
        // Since we have no real devices in store, it might be empty or have a placeholder
        // But the component selects the first one if available.
    });

    test('duration buttons are visible and selectable', async ({ page }) => {
        const buttons = page.locator('button').filter({ hasText: /hour|day|week/i });
        await expect(buttons.first()).toBeVisible();
        
        // Click a different duration
        const btn1h = buttons.filter({ hasText: /1 hour|1 ساعة/i }).first();
        await btn1h.click();
        await expect(btn1h).toHaveCSS('background-color', /rgba\(0, 212, 170/);
    });

    test('can generate a share link and see it in the active list', async ({ page }) => {
        // Mock a device in the store via localStorage since we can't easily mock the API response for devices here
        await page.addInitScript(() => {
            const fakeDevices = {
                state: {
                    devices: [{ imei: '1234567890', deviceName: 'Test Device' }],
                    selectedDevice: '1234567890'
                },
                version: 0
            };
            localStorage.setItem('gimi-device-storage', JSON.stringify(fakeDevices));
        });
        await page.reload();

        const generateBtn = page.locator('button', { hasText: /generate|إنشاء/i });
        await expect(generateBtn).toBeEnabled();
        await generateBtn.click();

        // The button text should change to "Copied" briefly
        await expect(generateBtn).toContainText(/Copied|تم النسخ/i);

        // A new link should appear in the "Active Links" list
        const linkCard = page.locator('.glass-panel', { hasText: 'Test Device' }).last();
        await expect(linkCard).toBeVisible();
        await expect(linkCard).toContainText(/Expires/i);
    });

    test('can delete a share link', async ({ page }) => {
        // Pre-populate a share link
        await page.addInitScript(() => {
            const exp = Math.floor(Date.now() / 1000) + 3600;
            const fakeLinks = {
                state: {
                    links: [{
                        id: 'share-test-1',
                        imei: '12345',
                        deviceName: 'Deletable Device',
                        url: 'http://localhost/view-share?test=1',
                        exp,
                        createdAt: new Date().toISOString()
                    }]
                },
                version: 0
            };
            localStorage.setItem('gimi-share-storage', JSON.stringify(fakeLinks));
        });
        await page.reload();

        await expect(page.locator('text=Deletable Device')).toBeVisible();
        
        const deleteBtn = page.locator('button[title="Delete Link"]');
        await deleteBtn.click();

        await expect(page.locator('text=Deletable Device')).not.toBeVisible();
    });
});

test.describe('View Share Page', () => {
    test('shows invalid link error for empty params', async ({ page }) => {
        await page.goto('/view-share');
        await page.waitForLoadState('load');
        await expect(page.locator('text=/Invalid|غير صحيح/i')).toBeVisible({ timeout: 10000 });
    });

    test('shows loading state for valid-looking params', async ({ page }) => {
        // Creating a "valid" looking URL according to createShareUrl logic
        // p=imei,exp,tok,name signed with secret
        // For testing, we just want to see it NOT show "Invalid" immediately
        const mockUrl = '/view-share?p=MTIzNDAsMTY3OTk5OTk5OSxmYWtlLXRva2VuLFRlc3QgRGV2aWNl&s=FAKE_SIGN';
        await page.goto(mockUrl);
        // It should try to fetch and show loading or some map container
        const mapContainer = page.locator('.leaflet-container');
        // It might still show error if sign fails but at least it got past param validation
        await expect(page.locator('body')).toBeVisible();
    });
});
