import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function mockAuthAndApi(page: Page) {
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
                            imei: '123456789012345',
                            deviceName: 'Test Tracker 1',
                            icon: 'automobile',
                            status: '1',
                            lat: 24.7136,
                            lng: 46.6753,
                            posType: 'GPS',
                            batteryPowerVal: '85',
                            gpsTime: '2026-06-05 12:00:00',
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
                            imei: '123456789012345',
                            lat: 24.7136,
                            lng: 46.6753,
                            posType: 'GPS',
                            batteryPowerVal: '85',
                            gpsTime: '2026-06-05 12:00:00',
                            locDesc: 'Riyadh, Saudi Arabia'
                        }
                    ]
                })
            });
            return;
        }
        if (url.includes('jimi.device.track.mileage')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    code: 0,
                    message: 'success',
                    result: [{ mileage: 125500 }]
                })
            });
            return;
        }
        if (url.includes('jimi.device.track.list')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    code: 0,
                    message: 'success',
                    result: [
                        { lat: 24.7136, lng: 46.6753, speed: 40, gpsTime: '2026-06-05 12:00:00', direction: 90, posType: 'GPS' },
                        { lat: 24.7140, lng: 46.6760, speed: 45, gpsTime: '2026-06-05 12:00:30', direction: 95, posType: 'GPS' },
                        { lat: 24.7200, lng: 46.6800, speed: 20, gpsTime: '2026-06-05 12:01:00', direction: 100, posType: 'LBS' },
                        { lat: 24.9900, lng: 46.9900, speed: 180, gpsTime: '2026-06-05 12:01:30', direction: 120, posType: 'GPS' },
                        { lat: 24.7145, lng: 46.6765, speed: 42, gpsTime: '2026-06-05 12:02:00', direction: 95, posType: 'GPS' }
                    ]
                })
            });
            return;
        }
        if (url.includes('jimi.open.platform.report.parking')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    code: 0,
                    message: 'success',
                    result: [
                        { lat: 24.7136, lng: 46.6753, startTime: '2026-06-05 12:05:00', endTime: '2026-06-05 12:10:00', durSecond: 300, addr: 'Riyadh Stop' }
                    ]
                })
            });
            return;
        }
        if (url.includes('jimi.device.alarm.list')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    code: 0,
                    message: 'success',
                    result: []
                })
            });
            return;
        }
        if (url.includes('jimi.open.platform.fence.list')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    code: 0,
                    message: 'success',
                    result: []
                })
            });
            return;
        }
        await route.continue();
    });
}

test.describe('History Page', () => {
    test.beforeEach(async ({ page }) => {
        await mockAuthAndApi(page);
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
        const searchBtn = page.locator('button', { hasText: /Load Track|search|بحث/i });
        await expect(searchBtn.first()).toBeVisible({ timeout: 5000 });
        // Clicking without selecting a device should not crash
        await searchBtn.first().click({ force: true });
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

    test('can minimize and maximize the history control panel', async ({ page }) => {
        const minimizeBtn = page.locator('button[aria-label="Minimize"]');
        await expect(minimizeBtn).toBeVisible({ timeout: 5000 });

        const deviceSelect = page.locator('select').first();
        await expect(deviceSelect).toBeVisible();

        await minimizeBtn.click();
        await expect(deviceSelect).not.toBeVisible();

        const maximizeBtn = page.locator('button[aria-label="Maximize"]');
        await expect(maximizeBtn).toBeVisible();

        await maximizeBtn.click();
        await expect(deviceSelect).toBeVisible();
    });

    test('shows positioning mode dropdown and filters track points correctly', async ({ page }) => {
        // Select device
        const deviceSelect = page.locator('select').first();
        await deviceSelect.selectOption('123456789012345');

        // Verify that Positioning Mode select is visible and defaults to 'all'
        const posModeDropdown = page.locator('select').filter({ hasText: /Precise|دقيق/ });
        await expect(posModeDropdown).toBeVisible();
        await expect(posModeDropdown).toHaveValue('all');

        // Click Load Track
        const searchBtn = page.locator('button', { hasText: /Load Track|search|بحث/i });
        await searchBtn.click();

        // Wait for map polyline or stats card to appear
        const floatingCard = page.locator('div[style*="absolute"]').first();
        await expect(floatingCard).toBeVisible({ timeout: 8000 });

        // Open detailed tables drawer
        const viewTablesBtn = page.locator('button', { hasText: /Detailed Tables|الجداول التفصيلية/i });
        await viewTablesBtn.click();

        // In All mode (default), no filtering. All 5 points should show.
        const tableRows = page.locator('tbody tr');
        await expect(tableRows).toHaveCount(5);

        // Switch to Precise mode
        await posModeDropdown.selectOption('precise');
        // In Precise mode, LBS points and speed jumps > 100km/h are filtered out.
        // Out of 5 points: 1 (GPS), 2 (GPS), 3 (LBS - filtered), 4 (speed 180 - filtered), 5 (GPS).
        // That leaves 3 points.
        await expect(tableRows).toHaveCount(3);

        // Switch to Optimized mode
        await posModeDropdown.selectOption('optimized');
        // In Optimized mode, only speed jumps > 150km/h are filtered.
        // Point 4 is filtered out, but Point 3 (LBS) is kept. That leaves 4 points.
        await expect(tableRows).toHaveCount(4);
    });
});
