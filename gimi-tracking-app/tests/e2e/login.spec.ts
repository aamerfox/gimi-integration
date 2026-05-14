import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
    });

    test('should display login form with correct elements', async ({ page }) => {
        // Logo / branding
        await expect(page.locator('h1')).toContainText('SaudiEx');
        await expect(page.getByText('Fleet Tracking Platform')).toBeVisible();

        // Inputs
        await expect(page.getByPlaceholder('Enter your account ID')).toBeVisible();
        await expect(page.getByPlaceholder('Enter your password')).toBeVisible();

        // Submit button
        await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();

        // Footer
        await expect(page.getByText('Powered by TrackSolid Pro')).toBeVisible();
    });

    test('should show error on invalid credentials', async ({ page }) => {
        await page.getByPlaceholder('Enter your account ID').fill('invalid_user_xyz');
        await page.getByPlaceholder('Enter your password').fill('wrongpassword_xyz');
        await page.getByRole('button', { name: 'Sign In' }).click();

        // Button should show loading spinner during request
        await expect(page.getByText('Signing in...')).toBeVisible({ timeout: 3000 });

        // After the failed request, button returns to 'Sign In' and we stay on /login
        await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible({ timeout: 15000 });
        await expect(page).toHaveURL(/\/login/);
    });

    test('should not allow submitting with empty fields', async ({ page }) => {
        // HTML5 validation – form should not submit
        await page.getByRole('button', { name: 'Sign In' }).click();

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
