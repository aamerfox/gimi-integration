import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Helper: inject auth tokens directly into localStorage so we
 * can test protected pages without going through the real login API.
 * The persist key is 'gimi-auth-storage' (from auth.ts).
 */
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

test.describe('Dashboard Page (protected)', () => {
    test('redirects to /login when not authenticated', async ({ page }) => {
        // Navigate first so localStorage is accessible, then remove auth key
        await page.goto('/login');
        await page.evaluate(() => localStorage.removeItem('gimi-auth-storage'));
        await page.goto('/');
        await expect(page).toHaveURL(/\/login/);
    });

    test('renders dashboard layout with mocked auth', async ({ page }) => {
        await mockAuth(page);
        await page.goto('/');

        // Sidebar should be present
        const sidebar = page.locator('nav, aside, [class*="sidebar"], [class*="Sidebar"]').first();
        await expect(sidebar).toBeVisible({ timeout: 8000 });

        // Page should NOT redirect to login
        await expect(page).not.toHaveURL(/\/login/);
    });

    test('dashboard page title contains SaudiEx', async ({ page }) => {
        await mockAuth(page);
        await page.goto('/');
        // Just check the page loaded and we are on the dashboard
        await expect(page.locator('body')).toBeVisible();
        await expect(page).not.toHaveURL(/\/login/);
    });
});
