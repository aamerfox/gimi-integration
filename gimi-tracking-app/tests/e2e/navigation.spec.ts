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

test.describe('Sidebar Navigation', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
        page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));

        await mockAuth(page);
        await page.goto('/');
        // Wait for the app to fully load
        await page.waitForLoadState('networkidle');
    });

    test('navigates to History page via sidebar', async ({ page }) => {
        // Look for History link in sidebar (text or href-based)
        await page.locator('nav, .sidebar').first().hover();
        const historyLink = page.locator('a[href="/history"]').first();
        await historyLink.click({ force: true });
        await expect(page).toHaveURL(/\/history/);
    });

    test('navigates to Geofences page via sidebar', async ({ page }) => {
        await page.locator('nav, .sidebar').first().hover();
        const geofencesLink = page.locator('a[href="/geofences"]').first();
        await geofencesLink.click({ force: true });
        await expect(page).toHaveURL(/\/geofences/);
    });

    test('navigates to Alerts page via sidebar', async ({ page }) => {
        await page.locator('nav, .sidebar').first().hover();
        const alertsLink = page.locator('a[href="/alerts"]').first();
        await alertsLink.click({ force: true });
        await expect(page).toHaveURL(/\/alerts/);
    });

    test('dashboard link navigates back to /', async ({ page }) => {
        // Go to history first
        await page.goto('/history');
        await page.waitForLoadState('networkidle');

        // The home/dashboard link is labelled 'Live Map' in the sidebar
        await page.locator('nav, .sidebar').first().hover();
        const livemapLink = page.locator('a[href="/"]').first();
        await livemapLink.click({ force: true });
        await expect(page).toHaveURL(/\/$/);
    });
});

test.describe('Page Content Checks', () => {
    test.beforeEach(async ({ page }) => {
        await mockAuth(page);
    });

    test('History page renders without crashing', async ({ page }) => {
        await page.goto('/history');
        await page.waitForLoadState('networkidle');
        // Should NOT be on login page
        await expect(page).not.toHaveURL(/\/login/);
        // Page should have some content
        await expect(page.locator('body')).not.toBeEmpty();
    });

    test('Geofences page renders without crashing', async ({ page }) => {
        await page.goto('/geofences');
        await page.waitForLoadState('networkidle');
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page.locator('body')).not.toBeEmpty();
    });

    test('Alerts page renders without crashing', async ({ page }) => {
        await page.goto('/alerts');
        await page.waitForLoadState('networkidle');
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page.locator('body')).not.toBeEmpty();
    });
});
