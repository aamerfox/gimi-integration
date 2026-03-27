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

test.describe('Alerts Page', () => {
    test.beforeEach(async ({ page }) => {
        await mockAuth(page);
        await page.goto('/alerts');
        await page.waitForLoadState('load');
    });

    test('renders alerts header and Add Rule button', async ({ page }) => {
        // Header should be visible (h2 containing the alerts icon and title)
        const header = page.locator('h2').first();
        await expect(header).toBeVisible({ timeout: 8000 });

        // "Add" / "+ Add Rule" button should be present
        const addBtn = page.locator('button', { hasText: /add/i }).first();
        await expect(addBtn).toBeVisible();
    });

    test('opens Add Alert Rule modal on click', async ({ page }) => {
        // Click the primary "Add" button in the header
        const addBtn = page.locator('button.sx-btn-primary', { hasText: /add/i }).first();
        await addBtn.click();

        // Modal should appear — it has an h3 title "Add Alert Rule" or translated
        const modal = page.locator('div[style*="fixed"]').first();
        await expect(modal).toBeVisible({ timeout: 5000 });

        // Rule name input should be in the modal
        const ruleNameInput = page.locator('input.sx-input').first();
        await expect(ruleNameInput).toBeVisible();
    });

    test('dismisses Add Alert modal when Cancel is clicked', async ({ page }) => {
        const addBtn = page.locator('button.sx-btn-primary', { hasText: /add/i }).first();
        await addBtn.click();

        // Modal is open
        const modal = page.locator('div[style*="fixed"]').first();
        await expect(modal).toBeVisible({ timeout: 5000 });

        // Click Cancel
        const cancelBtn = page.locator('button', { hasText: /cancel/i });
        await cancelBtn.click();

        // Modal should be gone
        await expect(modal).not.toBeVisible({ timeout: 5000 });
    });

    test('alert rule Create button is disabled when name is empty', async ({ page }) => {
        const addBtn = page.locator('button.sx-btn-primary', { hasText: /add/i }).first();
        await addBtn.click();

        // The Create Rule button should start disabled
        const createBtn = page.locator('button.sx-btn-primary', { hasText: /create/i });
        await expect(createBtn).toBeDisabled({ timeout: 5000 });
    });

    test('can create an alert rule and see it in the rules list', async ({ page }) => {
        const addBtn = page.locator('button.sx-btn-primary', { hasText: /add/i }).first();
        await addBtn.click();

        // Fill rule name
        const ruleNameInput = page.locator('input.sx-input').first();
        await ruleNameInput.fill('Test Overspeed Alert');

        // Create Rule button should be enabled now
        const createBtn = page.locator('button.sx-btn-primary', { hasText: /create/i });
        await expect(createBtn).toBeEnabled({ timeout: 3000 });

        await createBtn.click();

        // Modal should close
        await expect(page.locator('div[style*="fixed"]')).not.toBeVisible({ timeout: 5000 });

        // The newly created rule should appear in the list
        await expect(page.locator('text=Test Overspeed Alert')).toBeVisible({ timeout: 5000 });
    });

    test('can delete an alert rule', async ({ page }) => {
        // First, create a rule
        const addBtn = page.locator('button.sx-btn-primary', { hasText: /add/i }).first();
        await addBtn.click();
        const ruleNameInput = page.locator('input.sx-input').first();
        await ruleNameInput.fill('Rule to Delete');
        const createBtn = page.locator('button.sx-btn-primary', { hasText: /create/i });
        await createBtn.click();

        // Wait for rule to appear
        await expect(page.locator('text=Rule to Delete')).toBeVisible({ timeout: 5000 });

        // Click delete (trash icon button next to rule)
        const deleteBtn = page.locator('button.sx-btn-icon').last();
        await deleteBtn.click();

        // Rule should no longer be visible
        await expect(page.locator('text=Rule to Delete')).not.toBeVisible({ timeout: 5000 });
    });

    test('filter buttons are visible and clickable', async ({ page }) => {
        // There should be filter buttons (All, Geofence, Battery, etc.)
        const filterBtns = page.locator('button.sx-btn-ghost, button.sx-btn-primary').filter({ hasText: /all|geofence|battery/i });
        await expect(filterBtns.first()).toBeVisible({ timeout: 5000 });

        // Click the "Geofence" filter
        const geofenceFilter = page.locator('button', { hasText: /geofence/i }).first();
        await geofenceFilter.click();
        // Filter button state changes — it should become primary
        await expect(geofenceFilter).toHaveClass(/sx-btn-primary/, { timeout: 3000 });
    });

    test('Refresh button triggers a reload state', async ({ page }) => {
        const refreshBtn = page.locator('button', { hasText: /refresh|↻/i }).first();
        await expect(refreshBtn).toBeVisible({ timeout: 5000 });
        await refreshBtn.click();

        // After click it may show "Loading" or disabled state briefly
        // Just verify it doesn't crash and remains usable
        await expect(page.locator('body')).toBeVisible();
        await expect(page).not.toHaveURL(/login/);
    });

    test('date range inputs are present and editable', async ({ page }) => {
        const dateInputs = page.locator('input[type="datetime-local"]');
        // There should be 2 date pickers (start & end)
        await expect(dateInputs).toHaveCount(2, { timeout: 5000 });

        // Both should be interactable
        await expect(dateInputs.first()).toBeEnabled();
        await expect(dateInputs.last()).toBeEnabled();
    });
});
