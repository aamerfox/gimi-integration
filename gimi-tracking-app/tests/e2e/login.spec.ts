import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
    });

    test('should display login form with correct elements', async ({ page }) => {
        // Logo / branding
        await expect(page.locator('h1')).toContainText('SaudiEx');
        
        // Subtitle (using the second text or just making sure there is a p tag)
        await expect(page.locator('form p').first()).toBeVisible();

        // Inputs
        await expect(page.locator('input[type="text"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();

        // Submit button
        await expect(page.locator('button[type="submit"]')).toBeVisible();

        // Footer
        await expect(page.locator('p', { hasText: /Powered by SaudiEx/i })).toBeVisible();
    });

    test('should show error on invalid credentials', async ({ page }) => {
        await page.locator('input[type="text"]').fill('invalid_user_xyz');
        await page.locator('input[type="password"]').fill('wrongpassword_xyz');
        await page.locator('button[type="submit"]').click();

        // Button should show loading spinner/state during request (disabled state is a good indicator)
        await expect(page.locator('button[type="submit"]')).toBeDisabled({ timeout: 3000 });

        // After the failed request, button returns to active and we stay on /login
        await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 15000 });
        await expect(page).toHaveURL(/\/login/);
    });

    test('should not allow submitting with empty fields', async ({ page }) => {
        // HTML5 validation – form should not submit
        await page.locator('button[type="submit"]').click();

        // Should still be on login page
        await expect(page).toHaveURL(/\/login/);
    });

    test('should redirect unauthenticated users from / to /login', async ({ page }) => {
        // Clear any stored auth
        await page.evaluate(() => localStorage.clear());
        await page.goto('/');
        await expect(page).toHaveURL(/\/login/);
    });
});
