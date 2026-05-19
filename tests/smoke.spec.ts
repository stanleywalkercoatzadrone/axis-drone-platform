import { test, expect } from '@playwright/test';

test('app should load and display login page without crashing', async ({ page }) => {
  await page.goto('/');
  
  // Wait for the login component or the client signup to appear.
  // We can look for common text like "Email" or "Password" or "Sign In"
  await expect(page.locator('body')).toBeVisible();
  
  // Basic smoke test - make sure we don't have a blank screen
  const pageText = await page.textContent('body');
  expect(pageText?.length).toBeGreaterThan(50);
});
