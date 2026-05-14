import { test, expect } from '@playwright/test';

test('Comprehensive B2C App Features Verification', async ({ page }) => {
  // 1. Navigate to the local consumer app on the Vite server (port 5175)
  await page.goto('http://localhost:5175/login');

  // 2. Log in securely
  await page.getByPlaceholder('رقم الحساب').fill('saudiextest3');
  await page.getByPlaceholder('كلمة المرور').fill('saudiex123');
  await page.getByText('دخول', { exact: true }).click();
  await page.waitForURL('http://localhost:5175/');

  // 3. Verify Dashboard
  await expect(page.locator('text=لوحة التحكم الذكية')).toBeVisible();
  
  // 4. Test Home Dashboard Buttons
  await page.locator('text=المناطق الجغرافية').first().click();
  await page.waitForURL('http://localhost:5175/geofences');
  
  // 5. Test Geofences specific UI
  await expect(page.getByText('المناطق الجغرافية')).toBeVisible();
  await page.screenshot({ path: 'tests/snapshots/1_geofences_module.png' });

  // 6. Test Reports via Bottom Nav
  await page.locator('.bottom-nav-item').filter({ hasText: 'التقارير' }).click();
  await page.waitForURL('http://localhost:5175/reports');
  await expect(page.locator('text=تقرير التحليلات')).toBeVisible();
  
  // Click on a Tab inside Reports
  await page.getByRole('button', { name: 'السرعة' }).click();
  await page.screenshot({ path: 'tests/snapshots/2_reports_module.png' });

  // 7. Test Settings via Bottom Nav
  await page.locator('.bottom-nav-item').filter({ hasText: 'الإعدادات' }).click();
  await page.waitForURL('http://localhost:5175/settings');
  
  // Toggle standard switches in settings to ensure reactivity
  await page.getByText('تفعيل الإشعارات', { exact: true }).click();
  await page.getByText('الوضع الداكن', { exact: true }).click();
  
  // Verify Themes display
  await expect(page.locator('text=الهوية المؤسسية')).toBeVisible();
  await page.screenshot({ path: 'tests/snapshots/3_settings_module.png' });

  // 8. Test Logout Logic in Settings
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
  await page.waitForURL('http://localhost:5175/login');

  // Verify successful logout
  await expect(page.locator('text=تسجيل الدخول').first()).toBeVisible();
  await page.screenshot({ path: 'tests/snapshots/4_logout_success.png' });

  console.log('✅ All internal modules & features successfully tested!');
});
