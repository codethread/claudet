import { test, expect } from '@playwright/test';

test.describe('Claude Chat Interface', () => {
	test('should expose socket to window for WebSocket verification', async ({ page }) => {
		await page.goto('/');

		// Wait for page to load and socket to be exposed
		await expect(page.getByRole('heading', { name: 'Good morning, Adam' })).toBeVisible();

		// Verify socket is exposed to window in test mode
		const socketExists = await page.evaluate(() => {
			return typeof (window as any).__socket !== 'undefined';
		});

		expect(socketExists).toBe(true);

		// Verify socket has required properties
		const socketProps = await page.evaluate(() => {
			const socket = (window as any).__socket;
			return {
				hasConnected: typeof socket.connected === 'boolean',
				hasId: typeof socket.id === 'string',
				hasEmit: typeof socket.emit === 'function',
				hasOn: typeof socket.on === 'function',
			};
		});

		expect(socketProps.hasConnected).toBe(true);
		expect(socketProps.hasId).toBe(true);
		expect(socketProps.hasEmit).toBe(true);
		expect(socketProps.hasOn).toBe(true);
	});

	test('should capture screenshots for mobile (iPhone 6) and desktop viewports', async ({
		page,
	}) => {
		// FakeClaudeCodeService responds in ~500ms, but WebSocket connection may take time
		// Allow extra time for WebSocket reconnection in test environment
		test.setTimeout(60000);

		// Desktop viewport test
		await test.step('Desktop viewport screenshot', async () => {
			await page.setViewportSize({ width: 1920, height: 1080 });
			await page.goto('/');

			// Wait for the page to be fully loaded by checking for main heading
			await expect(page.getByRole('heading', { name: 'Good morning, Adam' })).toBeVisible();

			// Wait for WebSocket connection by waiting for send button to be enabled
			// Both input and send button are disabled until WebSocket connects
			const sendButton = page.getByRole('button', { name: '→' });
			await expect(sendButton).toBeEnabled({ timeout: 20000 });

			// Small delay to ensure state machine has processed WebSocket connection
			// Socket.IO "connect" event needs time to propagate to chatMachine
			await page.waitForTimeout(500);

			// Type a very precise message that should get a deterministic response
			const input = page.getByTestId('chat-input');
			await input.fill(
				'Please respond with exactly these three words in order: "Apple Banana Cherry". Do not add any additional text, punctuation, or explanation.',
			);

			// Click send button (arrow button)
			await sendButton.click();

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
				fullPage: true,
			});
		});

		// Mobile viewport test (iPhone 6)
		await test.step('Mobile (iPhone 6) viewport screenshot', async () => {
			// iPhone 6 dimensions: 375x667
			await page.setViewportSize({ width: 375, height: 667 });
			await page.goto('/');

			// Wait for the page to be fully loaded by checking for main heading
			await expect(page.getByRole('heading', { name: 'Good morning, Adam' })).toBeVisible();

			// Wait for WebSocket connection by waiting for send button to be enabled
			const sendButton = page.getByRole('button', { name: '→' });
			await expect(sendButton).toBeEnabled({ timeout: 20000 });

			// Small delay to ensure state machine has processed WebSocket connection
			await page.waitForTimeout(500);

			// Type a very precise message
			const input = page.getByTestId('chat-input');
			await input.fill(
				'Count from 1 to 5, outputting only the numbers separated by spaces. Example format: 1 2 3 4 5',
			);

			// Click send button (arrow button)
			await sendButton.click();

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
				fullPage: true,
			});
		});
	});

	test('should display chat interface elements correctly', async ({ page }) => {
		await page.goto('/');

		// Check main heading
		await expect(page.getByRole('heading', { name: 'Good morning, Adam' })).toBeVisible();

		// Check hamburger menu button (opens settings sidebar)
		const menuButtons = page.getByRole('button').filter({ has: page.locator('svg') });
		await expect(menuButtons.first()).toBeVisible();

		// Check plus button for new session (in top right)
		await expect(
			page
				.getByRole('button')
				.filter({ has: page.locator('svg') })
				.nth(1),
		).toBeVisible();

		// Check input field (using stable test ID)
		await expect(page.getByTestId('chat-input')).toBeVisible();

		// Check send button (arrow)
		await expect(page.getByRole('button', { name: '→' })).toBeVisible();
	});

	test('should send a message and receive response', async ({ page }) => {
		// FakeClaudeCodeService responds in ~500ms, but WebSocket connection may take time
		// Allow extra time for WebSocket reconnection in test environment
		test.setTimeout(60000);

		await page.goto('/');

		// Wait for WebSocket connection by waiting for send button to be enabled
		const sendButton = page.getByRole('button', { name: '→' });
		await expect(sendButton).toBeEnabled({ timeout: 20000 });

		// Small delay to ensure state machine has processed WebSocket connection
		await page.waitForTimeout(500);

		// Type a deterministic prompt
		const input = page.getByTestId('chat-input');
		await input.fill('What is 2 + 2? Please respond with only the number, no explanation.');

		// Click send button (arrow)
		await sendButton.click();

		// Wait for user message
		await expect(page.getByText('What is 2 + 2?')).toBeVisible();

		// Wait for thinking indicator
		await expect(page.getByText('Thinking...')).toBeVisible({ timeout: 2000 });

		// Wait for response (fake service responds in ~500ms)
		await expect(page.getByText('Thinking...')).not.toBeVisible({ timeout: 3000 });

		// Check that we have at least 2 messages (user + assistant)
		const messages = page.locator('[class*="rounded-xl"]').filter({ hasText: /You|Claude/ });
		await expect(messages).toHaveCount(2, { timeout: 2000 });
	});

	test('should verify WebSocket traffic with requestId correlation', async ({ page }) => {
		test.setTimeout(60000);

		await page.goto('/');

		// Wait for connection
		const sendButton = page.getByRole('button', { name: '→' });
		await expect(sendButton).toBeEnabled({ timeout: 20000 });
		await page.waitForTimeout(500);

		// Set up listener for WebSocket messages BEFORE sending
		const _wsMessages: any[] = [];
		await page.evaluate(() => {
			const socket = (window as any).__socket;
			if (!socket) throw new Error('Socket not exposed to window');

			// Store original emit and on functions
			const originalEmit = socket.emit.bind(socket);
			const originalOn = socket.on.bind(socket);

			// Track emitted messages
			socket.emit = (...args: any[]) => {
				(window as any).__wsMessages = (window as any).__wsMessages || [];
				(window as any).__wsMessages.push({ type: 'emit', event: args[0], data: args[1] });
				return originalEmit(...args);
			};

			// Track received messages
			const eventsToTrack = [
				'chat:response',
				'chat:error',
				'session:created',
				'session:error',
				'session:list',
			];
			eventsToTrack.forEach((eventName) => {
				originalOn(eventName, (data: any) => {
					(window as any).__wsMessages = (window as any).__wsMessages || [];
					(window as any).__wsMessages.push({ type: 'on', event: eventName, data });
				});
			});
		});

		// Send a message
		const input = page.getByTestId('chat-input');
		await input.fill('Test message for WebSocket verification');
		await sendButton.click();

		// Wait for response
		await expect(page.getByText('Thinking...')).toBeVisible({ timeout: 2000 });
		await expect(page.getByText('Thinking...')).not.toBeVisible({ timeout: 3000 });

		// Retrieve captured WebSocket messages
		const capturedMessages = await page.evaluate(() => {
			return (window as any).__wsMessages || [];
		});

		// Verify we captured messages
		expect(capturedMessages.length).toBeGreaterThan(0);

		// Find the chat:send emission
		const chatSendMessage = capturedMessages.find(
			(m: any) => m.type === 'emit' && m.event === 'chat:send',
		);
		expect(chatSendMessage).toBeDefined();
		expect(chatSendMessage.data).toHaveProperty('message');
		expect(chatSendMessage.data).toHaveProperty('sessionId');
		expect(chatSendMessage.data).toHaveProperty('requestId');

		// Verify requestId is a valid UUID
		const requestId = chatSendMessage.data.requestId;
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		expect(requestId).toMatch(uuidRegex);

		// Find the chat:response reception
		const chatResponseMessage = capturedMessages.find(
			(m: any) => m.type === 'on' && m.event === 'chat:response',
		);
		expect(chatResponseMessage).toBeDefined();
		expect(chatResponseMessage.data).toHaveProperty('type', 'chat:response');
		expect(chatResponseMessage.data.payload).toHaveProperty('response');
		expect(chatResponseMessage.data.payload).toHaveProperty('requestId');

		// Verify requestId correlation
		expect(chatResponseMessage.data.payload.requestId).toBe(requestId);

		console.log('✅ WebSocket traffic verified with requestId correlation');
	});

	test('should allow typing a long multi-line message that grows the input area', async ({
		page,
	}) => {
		await page.goto('/');

		// Wait for WebSocket connection
		const sendButton = page.getByRole('button', { name: '→' });
		await expect(sendButton).toBeEnabled({ timeout: 20000 });

		const input = page.getByTestId('chat-input');

		// Measure initial input height
		const initialBox = await input.boundingBox();
		const initialHeight = initialBox?.height || 0;

		// Type a multi-line message
		const multiLineMessage =
			'This is line 1\nThis is line 2\nThis is line 3\nThis is line 4\nThis is line 5';
		await input.fill(multiLineMessage);

		// Wait a moment for any resize animations
		await page.waitForTimeout(200);

		// Input should have grown to accommodate the text
		const grownBox = await input.boundingBox();
		const grownHeight = grownBox?.height || 0;
		expect(grownHeight).toBeGreaterThan(initialHeight);

		// User should still be able to see their message
		await expect(input).toHaveValue(multiLineMessage);

		// Send button should still be visible and clickable
		await expect(sendButton).toBeVisible();
	});

	test('should handle very long messages by scrolling the input area', async ({ page }) => {
		await page.goto('/');

		// Wait for WebSocket connection
		const sendButton = page.getByRole('button', { name: '→' });
		await expect(sendButton).toBeEnabled({ timeout: 20000 });

		const input = page.getByTestId('chat-input');

		// Type a very long message (20 lines)
		const veryLongMessage = Array.from(
			{ length: 20 },
			(_, i) => `This is line ${i + 1} of a very long message`,
		).join('\n');
		await input.fill(veryLongMessage);

		// Wait for any resize animations
		await page.waitForTimeout(200);

		// User should still be able to see the input field and interact with it
		await expect(input).toBeVisible();
		await expect(input).toHaveValue(veryLongMessage);

		// Send button should still be visible and clickable
		await expect(sendButton).toBeVisible();
		await expect(sendButton).toBeEnabled();

		// User should be able to clear and type new text
		await input.clear();
		await input.fill('New shorter message');
		await expect(input).toHaveValue('New shorter message');
	});

	test('should render markdown in chat messages', async ({ page }) => {
		test.setTimeout(60000);

		await page.goto('/');

		// Wait for WebSocket connection
		const sendButton = page.getByRole('button', { name: '→' });
		await expect(sendButton).toBeEnabled({ timeout: 20000 });
		await page.waitForTimeout(500);

		// Send a message with markdown content
		const input = page.getByTestId('chat-input');
		await input.fill(
			'Please respond with this markdown: **bold text**, *italic text*, `inline code`, and a link: [example](https://example.com)',
		);
		await sendButton.click();

		// Wait for user message
		await expect(page.getByText('Please respond with this markdown')).toBeVisible();

		// Wait for response
		await expect(page.getByText('Thinking...')).toBeVisible({ timeout: 2000 });
		await expect(page.getByText('Thinking...')).not.toBeVisible({ timeout: 3000 });

		// Wait for assistant message to appear
		await page.waitForTimeout(500);

		// Verify markdown is rendered as HTML elements (not plain text)
		// Check for bold text (both user and assistant messages will have markdown)
		const boldElements = page.locator('strong');
		await expect(boldElements.first()).toBeVisible();

		// Check for italic text
		const italicElements = page.locator('em');
		await expect(italicElements.first()).toBeVisible();

		// Check for inline code
		const codeElements = page.locator('code');
		await expect(codeElements.first()).toBeVisible();

		// Check for link with correct attributes
		const links = page.locator('a[target="_blank"][rel="noopener noreferrer"]');
		await expect(links.first()).toBeVisible();
		await expect(links.first()).toHaveAttribute('href', 'https://example.com');
	});

	test('should render code blocks with proper styling', async ({ page }) => {
		test.setTimeout(60000);

		await page.goto('/');

		// Wait for WebSocket connection
		const sendButton = page.getByRole('button', { name: '→' });
		await expect(sendButton).toBeEnabled({ timeout: 20000 });
		await page.waitForTimeout(500);

		// Send a message requesting a code block
		const input = page.getByTestId('chat-input');
		await input.fill('Please respond with a code block containing: ```\nconst x = 5;\n```');
		await sendButton.click();

		// Wait for response
		await expect(page.getByText('Thinking...')).toBeVisible({ timeout: 2000 });
		await expect(page.getByText('Thinking...')).not.toBeVisible({ timeout: 3000 });
		await page.waitForTimeout(500);

		// Check for code block element (non-inline code)
		const codeBlocks = page.locator('code').filter({
			has: page.locator('xpath=ancestor::div[contains(@class, "markdown-content")]'),
		});
		await expect(codeBlocks.first()).toBeVisible();
	});
});
