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

    test.fixme('can generate a share link', async ({ page }) => {
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
});
