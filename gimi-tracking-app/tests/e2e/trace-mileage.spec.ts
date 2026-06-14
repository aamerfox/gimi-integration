import { test, expect } from '@playwright/test';

test.describe('Tracksolid Pro Integration Features', () => {
    test.beforeEach(async ({ page }) => {
        // Log console outputs from browser
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
        page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));

        // Mock auth state
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

        // Mock device list and tracking API responses by checking URL query parameters
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
                        result: [{ mileage: 125500 }] // 125.5 km
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
                            { lat: 24.7136, lng: 46.6753, speed: 0, gpsTime: '2026-06-05 08:00:00', acc: '1' },
                            { lat: 24.7236, lng: 46.6853, speed: 40, gpsTime: '2026-06-05 08:05:00', acc: '1' },
                            { lat: 24.7336, lng: 46.6953, speed: 60, gpsTime: '2026-06-05 08:10:00', acc: '1' }
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
                        data: {
                            rows: [
                                {
                                    lat: 24.7236,
                                    lng: 46.6853,
                                    startTime: '2026-06-05 08:05:00',
                                    endTime: '2026-06-05 08:10:00',
                                    durSecond: 300,
                                    addr: 'Riyadh Stop Address'
                                }
                            ]
                        }
                    })
                });
                return;
            }
            // Fallback for other requests
            await route.continue();
        });
    });

    test('Dashboard shows Today Activity mileage and battery from API', async ({ page }) => {
        await page.goto('/');
        
        // Wait for device list to load and click on the device item
        const deviceItem = page.locator('text=Test Tracker 1').first();
        await expect(deviceItem).toBeVisible({ timeout: 10000 });
        await deviceItem.click();

        // Check that "Today's Activity" panel renders
        const activityTitle = page.locator('text=Today\'s Activity').first();
        await expect(activityTitle).toBeVisible();

        // Check Today's mileage is loaded (125500 meters / 1000 = 125.50 km)
        const mileageVal = page.locator('text=125.50 km');
        await expect(mileageVal).toBeVisible();

        // Check Battery strength (85%) - get the one in Today's Activity
        const batteryVal = page.locator('text=85%').last();
        await expect(batteryVal).toBeVisible();
    });

    test('History Page displays premium stops, duration, average speed and mileage', async ({ page }) => {
        await page.goto('/history');

        // Choose the device
        const deviceSelect = page.locator('select').first();
        await deviceSelect.selectOption({ label: 'Test Tracker 1 (123456789012345)' });

        // Click on "Load Track"
        const loadBtn = page.locator('button', { hasText: /Load Track/i }).first();
        await expect(loadBtn).toBeVisible();
        await loadBtn.click();

        // Journey summary checks
        const totalDist = page.locator('text=125.50 km').first();
        await expect(totalDist).toBeVisible();

        // Start and end points timeline
        const startPointLabel = page.locator('text=Start point');
        await expect(startPointLabel).toBeVisible();
        const endPointLabel = page.locator('text=End point');
        await expect(endPointLabel).toBeVisible();

        // Open detailed tables
        const viewTablesBtn = page.locator('button', { hasText: /View Detailed Tables/i });
        await viewTablesBtn.click();

        // Detailed tabs
        const playbackTab = page.locator('button', { hasText: /Playback Points/i });
        await expect(playbackTab).toBeVisible();
        const stopsTab = page.locator('button', { hasText: /Stops List/i });
        await expect(stopsTab).toBeVisible();

        // Click Stops list tab and verify address and duration
        await stopsTab.click();
        
        // Wait for stops table and address column to render address from report
        const stopAddr = page.locator('text=Riyadh Stop Address');
        await expect(stopAddr).toBeVisible();

        // Verify stop duration (300 seconds = 5 mins)
        const stopDuration = page.locator('text=5 mins');
        await expect(stopDuration).toBeVisible();
    });
});
