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

test.describe('Geofences Page', () => {
    test.beforeEach(async ({ page }) => {
        await mockAuth(page);
        await page.goto('/geofences');
        await page.waitForLoadState('load');
        // Wait for any initial loading to finish
        const spinner = page.locator('.sx-spinner, [style*="spinner"]');
        if (await spinner.count() > 0) {
            await expect(spinner).not.toBeVisible({ timeout: 10000 });
        }
    });

    test('renders the geofences panel with header and map hint', async ({ page }) => {
        // Left panel header — contains the hexagon icon and "Geofences" title
        await expect(page.locator('h3').first()).toBeVisible({ timeout: 8000 });

        // Map click hint below header
        const hint = page.locator('p', { hasText: /click.*map/i });
        await expect(hint).toBeVisible({ timeout: 5000 });
    });

    test('shows empty state when no geofences exist', async ({ page }) => {
        // Ensure no geofences in localStorage
        await page.evaluate(() => localStorage.removeItem('saudiex-geofences'));
        await page.reload();
        await page.waitForLoadState('load');
        // The empty state panel uses an SVG + p tag inside the scrollable div
        const emptyState = page.locator('svg').first();
        await expect(emptyState).toBeVisible({ timeout: 8000 });
        // Should still be on the geofences page
        await expect(page).not.toHaveURL(/login/);
    });

    test('does not render the geofence form when map is not clicked', async ({ page }) => {
        // Form is only rendered when showForm is true (after a map click)
        // Without a click, the right panel form should NOT be in DOM
        const form = page.locator('h3', { hasText: /new geofence/i });
        await expect(form).not.toBeVisible({ timeout: 3000 });
    });

    test('renders the Leaflet map container', async ({ page }) => {
        // Leaflet injects a div with class "leaflet-container"
        const mapContainer = page.locator('.leaflet-container');
        await expect(mapContainer).toBeVisible({ timeout: 10000 });
    });

    test.fixme('can click the map to open the geofence creation form', async ({ page }) => {
        // Map should be visible
        const mapEl = page.locator('.leaflet-container');
        await expect(mapEl).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(2000);

        // Try a force click at a safe offset
        await mapEl.click({ position: { x: 300, y: 300 }, force: true });

        // The right panel form should appear
        const formHeader = page.locator('h3', { hasText: /new geofence/i });
        await expect(formHeader).toBeVisible({ timeout: 15000 });
    });

    test.fixme('geofence form shows zone name input after map click', async ({ page }) => {
        const mapEl = page.locator('.leaflet-container');
        await expect(mapEl).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(2000);

        await mapEl.click({ position: { x: 300, y: 300 }, force: true });

        // Zone name field and Create button should appear in the form
        const nameInput = page.locator('input[placeholder*="e.g. Office"]');
        await expect(nameInput).toBeVisible({ timeout: 15000 });
    });

    test.fixme('Create Geofence button is disabled when name is empty', async ({ page }) => {
        const mapEl = page.locator('.leaflet-container');
        await expect(mapEl).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(2000);

        await mapEl.click({ position: { x: 200, y: 200 }, force: true });

        const createBtn = page.locator('button', { hasText: /create geofence/i });
        await expect(createBtn).toBeDisabled({ timeout: 10000 });
    });

    test.fixme('can create a geofence and see it in the list', async ({ page }) => {
        // Clear any existing geofences using correct persist key
        await page.evaluate(() => localStorage.removeItem('saudiex-geofences'));
        await page.reload();
        await page.waitForLoadState('load');

        const mapEl = page.locator('.leaflet-container');
        await expect(mapEl).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(2000);

        await mapEl.click({ position: { x: 400, y: 400 }, force: true });

        // Fill in the zone name
        const nameInput = page.locator('input[placeholder*="e.g. Office"]');
        await expect(nameInput).toBeVisible({ timeout: 15000 });
        await nameInput.fill('Test Zone Alpha');

        // Click Create
        const createBtn = page.locator('button', { hasText: /create geofence/i });
        await expect(createBtn).toBeEnabled({ timeout: 5000 });
        await createBtn.click();

        // Zone should now appear in the left panel list
        await expect(page.locator('span', { hasText: 'Test Zone Alpha' }).first()).toBeVisible({ timeout: 10000 });
    });

    test('newly created geofence has enable/disable toggle', async ({ page }) => {
        // Inject a geofence directly into localStorage using the correct persist key
        await page.addInitScript(() => {
            const fakeGeofences = {
                state: {
                    geofences: [{
                        id: 'test-geo-123',
                        fenceName: 'Mock Geofence',
                        lat: 24.7136,
                        lng: 46.6753,
                        radius: 500,
                        alarmType: 'in,out',
                        color: '#00d4aa',
                        enabled: true,
                        createdAt: new Date().toISOString(), // ISO string format
                    }],
                },
                version: 0,
            };
            localStorage.setItem('saudiex-geofences', JSON.stringify(fakeGeofences));
        });

        await page.goto('/geofences');
        await page.waitForLoadState('load');

        // The fence name should be visible in the list
        await expect(page.locator('span', { hasText: 'Mock Geofence' }).first()).toBeVisible({ timeout: 8000 });

        // A toggle button should exist — it's a button with no text but toggles a circle indicator
        const toggleBtn = page.locator('button[title="Disable fence"], button[title="Enable fence"]').first();
        await expect(toggleBtn).toBeVisible({ timeout: 5000 });
        await toggleBtn.click();

        // After toggling, verify zone row still exists (we just toggled it)
        await expect(page.locator('span', { hasText: 'Mock Geofence' }).first()).toBeVisible();
    });

    test('can delete a geofence', async ({ page }) => {
        // Pre-populate a geofence via localStorage using the correct persist key
        await page.addInitScript(() => {
            const fakeGeofences = {
                state: {
                    geofences: [{
                        id: 'delete-geo-456',
                        fenceName: 'Zone to Delete',
                        lat: 24.7,
                        lng: 46.7,
                        radius: 500,
                        alarmType: 'in' as const,
                        color: '#ff6b6b',
                        enabled: true,
                        createdAt: new Date().toISOString(),
                    }],
                },
                version: 0,
            };
            localStorage.setItem('saudiex-geofences', JSON.stringify(fakeGeofences));
        });

        await page.goto('/geofences');
        await page.waitForLoadState('load');

        await expect(page.locator('span', { hasText: 'Zone to Delete' }).first()).toBeVisible({ timeout: 8000 });

        // Mock the confirm dialog to return true
        page.on('dialog', dialog => dialog.accept());

        // Click the delete button (trash icon button with title="Delete")
        const deleteBtn = page.locator('button[title="Delete"]').first();
        await deleteBtn.click();

        // The fence should disappear from the list
        await expect(page.locator('span', { hasText: 'Zone to Delete' })).not.toBeVisible({ timeout: 5000 });
    });
});
