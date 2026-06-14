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
                    result: [{ imei: '123456789012345', mileage: 125500 }]
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
                        {
                            start_time: '2026-06-05 10:00:00',
                            end_time: '2026-06-05 11:30:00',
                            park_time: '1h 30m',
                            address: 'Olaya District, Riyadh',
                            park_time_second: 5400
                        }
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
                    result: [
                        {
                            imei: '123456789012345',
                            alarm_time: '2026-06-05 14:15:00',
                            alarm_type_name: 'Overspeed',
                            speed: 135,
                            address: 'Makkah Highway'
                        }
                    ]
                })
            });
            return;
        }
        if (url.includes('jimi.open.platform.report.trips')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    code: 0,
                    message: 'success',
                    result: [
                        {
                            imei: '123456789012345',
                            startTime: '2026-06-05 08:00:00',
                            endTime: '2026-06-05 09:30:00',
                            startLat: 24.7136,
                            startLng: 46.6753,
                            endLat: 24.7236,
                            endLng: 46.6853,
                            distance: 12500,
                            runTimeSecond: 5400,
                            averageSpeed: 50,
                            maxSpeed: 80
                        }
                    ]
                })
            });
            return;
        }
        if (url.includes('jimi.open.device.fence.list')) {
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

test.describe('Reports Page E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
        page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));

        await mockAuthAndApi(page);
        await page.goto('/reports');
        await page.waitForLoadState('networkidle');
    });

    test('renders Reports page header and initial layout', async ({ page }) => {
        // Confirm url
        await expect(page).toHaveURL(/\/reports/);

        // Check page title exists
        const heading = page.locator('h1');
        await expect(heading).toBeVisible();

        // Check that device select dropdown is populated
        const deviceSelect = page.locator('select').first();
        await expect(deviceSelect).toBeVisible();
        
        // Confirm there are options
        const options = deviceSelect.locator('option');
        await expect(options.first()).toHaveAttribute('value', 'all');
    });

    test('switches report types and displays correct stats and table', async ({ page }) => {
        // Toggle tabs
        const tripsTab = page.locator('button', { hasText: 'Trips' }).first();
        const parkingTab = page.locator('button', { hasText: 'Parking' }).first();
        const alarmsTab = page.locator('button', { hasText: 'Alarms' }).first();

        // Test Trips & Mileage Tab (default)
        await tripsTab.click();
        await expect(page.locator('text="Total Distance"')).toBeVisible();

        // Test Parking & Stops Tab
        await parkingTab.click();
        await expect(page.locator('text="Total Stops"')).toBeVisible();

        // Test Alarms Tab
        await alarmsTab.click();
        await expect(page.locator('text="Total Alarms"')).toBeVisible();
    });

    test('toggles simulation mode and triggers API vs mock data rendering', async ({ page }) => {
        // Simulation mode now defaults to OFF — toggle it ON to get mock data
        const simToggle = page.locator('button', { hasText: 'ON' }).or(page.locator('button', { hasText: 'OFF' })).first();
        await expect(simToggle).toBeVisible();

        // Toggle simulation to ON so we get instant mock data
        const text = await simToggle.textContent();
        if (text?.includes('OFF') || text?.includes('إيقاف')) {
            await simToggle.click();
            await expect(simToggle).toHaveText(/ON|تشغيل/);
        }

        // Click generate report to fetch mock data
        const generateBtn = page.locator('button', { hasText: 'Generate' }).or(page.locator('button', { hasText: 'توليد' })).first();
        await generateBtn.click();
        
        // Wait for mock data to render — simulation mode uses div-based cards not table rows
        await page.waitForTimeout(1000);

        // Confirm report shows summary stats (works for both table and card layouts)
        await expect(page.locator('text="Total Distance"').or(page.locator('text="إجمالي المسافة"'))).toBeVisible();
    });

    test('triggers CSV export download', async ({ page }) => {
        // First, turn ON simulation mode so we have data to export
        const simToggle = page.locator('button', { hasText: 'ON' }).or(page.locator('button', { hasText: 'OFF' })).first();
        await expect(simToggle).toBeVisible();
        const text = await simToggle.textContent();
        if (text?.includes('OFF') || text?.includes('إيقاف')) {
            await simToggle.click();
        }

        // Generate report to populate data
        const generateBtn = page.locator('button', { hasText: 'Generate' }).or(page.locator('button', { hasText: 'توليد' })).first();
        await generateBtn.click();
        await page.waitForTimeout(1500);

        // Find export button — should now be enabled with data
        const exportBtn = page.locator('button[title*="Export"]').or(page.locator('button[title*="تصدير"]')).first();
        await expect(exportBtn).toBeVisible();

        // Wait for download promise
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
        await exportBtn.click();
        const download = await downloadPromise;

        // Verify download details
        expect(download.suggestedFilename()).toContain('.csv');
    });

    test('renders report-specific filters based on selected tab', async ({ page }) => {
        const tripsTab = page.locator('button', { hasText: 'Trips' }).first();
        const parkingTab = page.locator('button', { hasText: 'Parking' }).first();
        const alarmsTab = page.locator('button', { hasText: 'Alarms' }).first();

        // 1. Check Trips Filters
        await tripsTab.click();
        const distanceFilterLabel = page.locator('text="Min Trip Distance"');
        await expect(distanceFilterLabel).toBeVisible();

        // 2. Check Parking Filters
        await parkingTab.click();
        const durationFilterLabel = page.locator('text="Min Stop Duration"');
        await expect(durationFilterLabel).toBeVisible();

        // 3. Check Alarms Filters
        await alarmsTab.click();
        const alarmFilterLabel = page.locator('text="Alarm Category"');
        await expect(alarmFilterLabel).toBeVisible();
    });

    test('calculates integrated distance fallback when API returns 0 distance', async ({ page }) => {
        // Override the APIs for this test
        await page.route('**/api**', async (route) => {
            const url = route.request().url();
            if (url.includes('jimi.open.platform.report.trips')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        code: 0,
                        message: 'success',
                        result: [
                            {
                                imei: '123456789012345',
                                startTime: '2026-06-05 08:00:00',
                                endTime: '2026-06-05 09:30:00',
                                startLat: 24.7136,
                                startLng: 46.6753,
                                endLat: 24.7336,
                                endLng: 46.6953,
                                distance: 0, // 0 distance!
                                runTimeSecond: 5400,
                                averageSpeed: 50,
                                maxSpeed: 80
                            }
                        ]
                    })
                });
            } else if (url.includes('jimi.device.track.mileage')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        code: 0,
                        message: 'success',
                        result: [{ imei: '123456789012345', mileage: 0 }]
                    })
                });
            } else if (url.includes('jimi.device.track.list')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        code: 0,
                        message: 'success',
                        result: [
                            { lat: 24.7136, lng: 46.6753, speed: 0, gpsTime: '2026-06-05 08:00:00' },
                            { lat: 24.7236, lng: 46.6853, speed: 40, gpsTime: '2026-06-05 08:05:00' },
                            { lat: 24.7336, lng: 46.6953, speed: 60, gpsTime: '2026-06-05 08:10:00' }
                        ]
                    })
                });
            } else {
                await route.fallback();
            }
        });

        // Select the device first to query instead of 'all'
        const deviceSelect = page.locator('select').first();
        await deviceSelect.selectOption({ value: '123456789012345' });

        // Click generate report to call the mocked APIs
        const generateBtn = page.locator('button', { hasText: 'Generate' }).or(page.locator('button', { hasText: 'توليد' })).first();
        await generateBtn.click();

        // Wait for processing and fallback calculation
        await page.waitForTimeout(2000);

        // Verify that the total distance displayed is 3.0 km (calculated from coordinates)
        const totalDist = page.locator('text=3.0 km').first();
        await expect(totalDist).toBeVisible();

        // Also check that it's visible in the table row
        const tableCell = page.locator('table tbody tr td').locator('text=3.0 km').first();
        await expect(tableCell).toBeVisible();
    });

    test('parses parking report correctly when API returns data.rows structure', async ({ page }) => {
        // Toggle tabs to Parking
        const parkingTab = page.locator('button', { hasText: 'Parking' }).first();
        await parkingTab.click();

        // Override the APIs for this test
        await page.route('**/api**', async (route) => {
            const url = route.request().url();
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
                                    start_time: '2026-06-05 15:00:00',
                                    end_time: '2026-06-05 16:30:00',
                                    park_time_second: 5400,
                                    address: 'Olaya District Test'
                                }
                            ]
                        }
                    })
                });
            } else {
                await route.fallback();
            }
        });

        // Select the device first to query (required for parking report)
        const deviceSelect = page.locator('select').first();
        await deviceSelect.selectOption({ value: '123456789012345' });

        // Click generate report
        const generateBtn = page.locator('button', { hasText: 'Generate' }).or(page.locator('button', { hasText: 'توليد' })).first();
        await generateBtn.click();

        // Wait for rendering
        await page.waitForTimeout(2000);

        // Verify the summary stat of stops
        const totalStops = page.locator('text=Total Stops').or(page.locator('text=إجمالي مرات الوقوف')).first();
        await expect(totalStops).toBeVisible();

        // Check if duration is parsed correctly from park_time_second (5400s = 1h 30m)
        const totalDuration = page.locator('text=1h 30m').first();
        await expect(totalDuration).toBeVisible();

        // Verify address is in the table row
        const addressCell = page.locator('table tbody tr td').locator('text=Olaya District Test').first();
        await expect(addressCell).toBeVisible();
    });
});
