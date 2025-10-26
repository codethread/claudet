import { test, expect } from '@playwright/test';

test.describe('Claude Chat Interface', () => {
  test('should capture screenshots for mobile (iPhone 6) and desktop viewports', async ({ page }) => {
    // FakeClaudeCodeService responds in ~500ms, so 15s is plenty
    test.setTimeout(15000);

    // Desktop viewport test
    await test.step('Desktop viewport screenshot', async () => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/');

      // Wait for the page to be fully loaded
      await expect(page.getByRole('heading', { name: 'Claude Chats' })).toBeVisible();

      // Wait for WebSocket connection
      await expect(page.getByText('Connected')).toBeVisible({ timeout: 3000 });

      // Type a very precise message that should get a deterministic response
      const input = page.getByPlaceholder('Type your message...');
      await input.fill('Please respond with exactly these three words in order: "Apple Banana Cherry". Do not add any additional text, punctuation, or explanation.');

      // Click send button
      await page.getByRole('button', { name: 'Send' }).click();

      // Wait for user message to appear
      await expect(page.getByText('Please respond with exactly these three words')).toBeVisible();

      // Wait for "Thinking..." to appear
      await expect(page.getByText('Thinking...')).toBeVisible({ timeout: 2000 });

      // Wait for the assistant's response (fake service responds in ~500ms)
      await expect(page.getByText('Thinking...')).not.toBeVisible({ timeout: 3000 });

      // Wait a bit for the UI to settle
      await page.waitForTimeout(500);

      // Take desktop screenshot
      await page.screenshot({
        path: 'tests/screenshots/desktop-chat.png',
        fullPage: true
      });
    });

    // Mobile viewport test (iPhone 6)
    await test.step('Mobile (iPhone 6) viewport screenshot', async () => {
      // iPhone 6 dimensions: 375x667
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      // Wait for the page to be fully loaded
      await expect(page.getByRole('heading', { name: 'Claude Chats' })).toBeVisible();

      // Wait for WebSocket connection
      await page.waitForTimeout(1000);

      // Type a very precise message
      const input = page.getByPlaceholder('Type your message...');
      await input.fill('Count from 1 to 5, outputting only the numbers separated by spaces. Example format: 1 2 3 4 5');

      // Click send button
      await page.getByRole('button', { name: 'Send' }).click();

      // Wait for user message to appear
      await expect(page.getByText('Count from 1 to 5')).toBeVisible();

      // Wait for "Thinking..." to appear
      await expect(page.getByText('Thinking...')).toBeVisible({ timeout: 2000 });

      // Wait for the assistant's response (fake service responds in ~500ms)
      await expect(page.getByText('Thinking...')).not.toBeVisible({ timeout: 3000 });

      // Wait a bit for the UI to settle
      await page.waitForTimeout(500);

      // Take mobile screenshot
      await page.screenshot({
        path: 'tests/screenshots/mobile-iphone6-chat.png',
        fullPage: true
      });
    });
  });

  test('should display chat interface elements correctly', async ({ page }) => {
    await page.goto('/');

    // Check main heading
    await expect(page.getByRole('heading', { name: 'Claude Chats' })).toBeVisible();

    // Check chat section heading
    await expect(page.getByRole('heading', { name: 'Chat with Claude' })).toBeVisible();

    // Check input field
    await expect(page.getByPlaceholder(/Type your message|Waiting for connection/)).toBeVisible();

    // Check send button
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();

    // Check connection status indicator
    await expect(page.locator('div').filter({ hasText: /Connected|Disconnected/ }).first()).toBeVisible();
  });

  test('should send a message and receive response', async ({ page }) => {
    // FakeClaudeCodeService responds in ~500ms, so 10s is plenty
    test.setTimeout(10000);

    await page.goto('/');

    // Wait for WebSocket connection
    await page.waitForTimeout(1000);

    // Type a deterministic prompt
    const input = page.getByPlaceholder('Type your message...');
    await input.fill('What is 2 + 2? Please respond with only the number, no explanation.');

    // Click send button
    await page.getByRole('button', { name: 'Send' }).click();

    // Wait for user message
    await expect(page.getByText('What is 2 + 2?')).toBeVisible();

    // Wait for thinking indicator
    await expect(page.getByText('Thinking...')).toBeVisible({ timeout: 2000 });

    // Wait for response (fake service responds in ~500ms)
    await expect(page.getByText('Thinking...')).not.toBeVisible({ timeout: 3000 });

    // Check that we have at least 2 messages (user + assistant)
    const messages = page.locator('[class*="rounded-lg"]').filter({ hasText: /You|Claude/ });
    await expect(messages).toHaveCount(2, { timeout: 2000 });
  });
});
