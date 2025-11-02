import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests',
	fullyParallel: false, // Run tests sequentially to avoid WebSocket connection conflicts
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1, // Single worker to avoid parallel connection issues
	reporter: 'line', // Use line reporter for immediate feedback (html reporter can hang)
	use: {
		baseURL: 'https://localhost:3000',
		trace: 'on-first-retry',
		ignoreHTTPSErrors: true, // Since we're using self-signed certs in dev
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],

	webServer: {
		command: 'bun dev:test', // Use test server with FakeClaudeCodeService
		url: 'https://localhost:3000',
		reuseExistingServer: !process.env.CI,
		ignoreHTTPSErrors: true,
		timeout: 120000,
	},
});
