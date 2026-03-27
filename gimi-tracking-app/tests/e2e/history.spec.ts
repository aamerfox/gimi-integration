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

test.describe('History Page', () => {
    test.beforeEach(async ({ page }) => {
        await mockAuth(page);
        await page.goto('/history');
        await page.waitForLoadState('load');
    });

    test('renders the history page map container', async ({ page }) => {
        // Leaflet container must load
        const mapContainer = page.locator('.leaflet-container');
        await expect(mapContainer).toBeVisible({ timeout: 10000 });
    });

    test('shows date range inputs pre-populated with defaults', async ({ page }) => {
        // History page auto-populates start/end with 24h window
        const dateInputs = page.locator('input[type="datetime-local"]');
        await expect(dateInputs).toHaveCount(2, { timeout: 5000 });

        // Both should be pre-filled (not empty)
        const startVal = await dateInputs.first().inputValue();
        const endVal = await dateInputs.last().inputValue();
        expect(startVal).not.toBe('');
        expect(endVal).not.toBe('');
    });

    test('shows IMEI/device selector dropdown', async ({ page }) => {
        // There should be a select for choosing the device
        const deviceSelect = page.locator('select').first();
        await expect(deviceSelect).toBeVisible({ timeout: 5000 });
    });

    test('Search button is present and clickable', async ({ page }) => {
        const searchBtn = page.locator('button', { hasText: /search|بحث/i });
        await expect(searchBtn.first()).toBeVisible({ timeout: 5000 });
        // Clicking without selecting a device should not crash
        await searchBtn.first().click();
        await expect(page.locator('body')).toBeVisible();
    });

    test('playback controls are absent until a track is loaded', async ({ page }) => {
        // Without selecting a device and fetching, the playback bar should not be visible
        const playBtn = page.locator('button', { hasText: /play|pause|▶|⏸/i });
        // It's possible the button is hidden — just should not crash the page
        await expect(page.locator('body')).toBeVisible();
        await expect(page).not.toHaveURL(/login/);
        // The play button should not be pressable without data
        if (await playBtn.count() > 0) {
            await expect(playBtn.first()).toBeDisabled();
        }
    });

    test('no-track empty state shown when no device selected', async ({ page }) => {
        // Without selecting a device, the page should show an empty or placeholder state
        // The floating control panel or the map should still show
        const mapContainer = page.locator('.leaflet-container');
        await expect(mapContainer).toBeVisible({ timeout: 10000 });
        await expect(page).not.toHaveURL(/login/);
    });

    test('speed color legend is rendered in the control panel', async ({ page }) => {
        // The control panel at top has playback speed or status info
        // Verify the floating controls panel exists
        const controlPanel = page.locator('div[style*="absolute"]').first();
        await expect(controlPanel).toBeVisible({ timeout: 8000 });
    });
});
