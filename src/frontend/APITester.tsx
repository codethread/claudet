import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMachine } from '@xstate/react';
import { chatMachine } from './chatMachine';
import { ThemeToggle } from './components/ThemeToggle';
import { MicButton } from './components/MicButton';
import { MarkdownMessage } from './components/MarkdownMessage';
import { Menu, Plus } from 'lucide-react';
import { useSocket } from './hooks/useSocket';
import type { Socket } from 'socket.io-client';

export function APITester() {
	// Socket.IO connection (handles reconnection automatically)
	const { socket, connected } = useSocket({ url: '/' });

	const _messageInputRef = useRef<HTMLTextAreaElement>(null);
	const _chatContainerRef = useRef<HTMLDivElement>(null);
	const [_leftSidebarOpen, _setLeftSidebarOpen] = useState(false);
	const [_rightSidebarOpen, _setRightSidebarOpen] = useState(false);
	const [_isUserScrolled, _setIsUserScrolled] = useState(false);

	// Wait for socket to be available before creating machine
	// This ensures we don't render the chat UI before socket is ready
	if (!socket) {
		return (
			<div className="h-full w-full flex items-center justify-center">
				<div className="text-center">
					<div className="text-lg font-medium">Connecting...</div>
					<div className="text-sm text-muted-foreground mt-2">
						Establishing WebSocket connection
					</div>
				</div>
			</div>
		);
	}

	return <APITesterContent socket={socket} connected={connected} />;
}

function APITesterContent({ socket, connected }: { socket: Socket; connected: boolean }) {
	const [state, send] = useMachine(chatMachine, {
		input: { socket },
	});

	const messageInputRef = useRef<HTMLTextAreaElement>(null);
	const chatContainerRef = useRef<HTMLDivElement>(null);
	const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
	const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
	const [isUserScrolled, setIsUserScrolled] = useState(false);

	// Setup Socket.IO event listeners
	useEffect(() => {
		// Connection established
		const handleConnect = () => {
			console.log('[socket] Connected');
			send({ type: 'WEBSOCKET_CONNECTED' });
		};

		// Connection lost
		const handleDisconnect = () => {
			console.log('[socket] Disconnected');
			send({ type: 'WEBSOCKET_DISCONNECTED' });
		};

		// Connection message (includes session list)
		const handleConnectionMessage = (data: unknown) => {
			console.log('[socket] Connection message received:', data);
			send({ type: 'WEBSOCKET_MESSAGE', data: JSON.stringify(data) });
		};

		// Log message
		const handleLog = (data: unknown) => {
			console.log('[socket] Log message received:', data);
			send({ type: 'WEBSOCKET_MESSAGE', data: JSON.stringify(data) });
		};

		// Error
		const handleError = (err: Error) => {
			// Suppress error logging in test/automation environments
			if (!navigator.webdriver) {
				console.error('[socket] Error:', err);
			}
			send({ type: 'WEBSOCKET_ERROR', error: err.message });
		};

		// Register event listeners
		socket.on('connect', handleConnect);
		socket.on('disconnect', handleDisconnect);
		socket.on('connection', handleConnectionMessage);
		socket.on('log', handleLog);
		socket.on('connect_error', handleError);

		// Check if already connected when effect runs (handle race condition)
		// Note: This may run multiple times in dev mode (React Strict Mode)
		if (socket.connected) {
			send({ type: 'WEBSOCKET_CONNECTED' });
		}

		// Expose socket to window for E2E testing
		if (navigator.webdriver) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(window as any).__socket = socket;
		}

		// Clean up on unmount
		return () => {
			socket.off('connect', handleConnect);
			socket.off('disconnect', handleDisconnect);
			socket.off('connection', handleConnectionMessage);
			socket.off('log', handleLog);
			socket.off('connect_error', handleError);
		};
	}, [socket, send]);

	const sendMessage = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		const message = messageInputRef.current!.value;
		if (!message.trim()) {
			return;
		}

		send({ type: 'SEND_MESSAGE', message });
		messageInputRef.current!.value = '';
		// Reset textarea height after sending
		messageInputRef.current!.style.height = 'auto';
	};

	const handleTranscribe = (text: string) => {
		const input = messageInputRef.current;
		if (!input) return;

		// Get current cursor position
		const start = input.selectionStart || 0;
		const end = input.selectionEnd || 0;
		const currentValue = input.value;

		// Insert text at cursor position
		const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
		input.value = newValue;

		// Set cursor position after inserted text
		const newCursorPos = start + text.length;
		input.setSelectionRange(newCursorPos, newCursorPos);

		// Focus the input
		input.focus();
	};

	const {
		sessionChatHistories,
		currentSessionId,
		selectedMessageIndex,
		currentLogs,
		sessions,
		selectedModel,
	} = state.context;
	const _isIdle = state.matches('idle');
	const isSending = state.matches('sending');
	const isReconnecting = state.matches('reconnecting') || !connected;
	const isLoading = isSending;

	// Memoize chatHistory to prevent unnecessary re-renders
	const chatHistory = useMemo(
		() => (currentSessionId ? sessionChatHistories.get(currentSessionId) || [] : []),
		[currentSessionId, sessionChatHistories],
	);

	const selectedMessage = selectedMessageIndex !== null ? chatHistory[selectedMessageIndex] : null;
	const _currentSession = sessions.find((s) => s.id === currentSessionId);

	// Debug logging - only log when sessionChatHistories actually changes
	useEffect(() => {
		console.log('[APITester] === State Debug ===');
		console.log('[APITester] currentSessionId:', currentSessionId);
		console.log('[APITester] sessions:', sessions);
		console.log('[APITester] sessionChatHistories keys:', Array.from(sessionChatHistories.keys()));
		console.log('[APITester] sessionChatHistories full contents:');
		sessionChatHistories.forEach((history, sessionId) => {
			console.log(`  Session ${sessionId.substring(0, 8)}: ${history.length} messages`);
			history.forEach((msg, idx) => {
				console.log(`    [${idx}] ${msg.role}: ${msg.content.substring(0, 50)}...`);
			});
		});
		console.log('[APITester] ==================');
	}, [currentSessionId, sessions, sessionChatHistories]);

	// Open right sidebar when message is selected
	useEffect(() => {
		if (selectedMessage) {
			setRightSidebarOpen(true);
		}
	}, [selectedMessage]);

	// Auto-resize textarea as user types
	useEffect(() => {
		const textarea = messageInputRef.current;
		if (!textarea) return;

		const adjustHeight = () => {
			textarea.style.height = 'auto';
			textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
		};

		textarea.addEventListener('input', adjustHeight);
		return () => textarea.removeEventListener('input', adjustHeight);
	}, []);

	// Auto-scroll to bottom when new messages arrive (unless user scrolled up)
	useEffect(() => {
		const container = chatContainerRef.current;
		if (!container || isUserScrolled) return;

		container.scrollTop = container.scrollHeight;
	}, [isUserScrolled]);

	// Track user scroll position
	useEffect(() => {
		const container = chatContainerRef.current;
		if (!container) return;

		const handleScroll = () => {
			const { scrollTop, scrollHeight, clientHeight } = container;
			const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 10;
			setIsUserScrolled(!isAtBottom);
		};

		container.addEventListener('scroll', handleScroll);
		return () => container.removeEventListener('scroll', handleScroll);
	}, []);

	return (
		<>
			{/* Left Sidebar - Model & Session Controls */}
			<Sheet open={leftSidebarOpen} onOpenChange={setLeftSidebarOpen}>
				<SheetContent side="left" className="w-[300px]">
					<SheetHeader>
						<SheetTitle>Settings</SheetTitle>
					</SheetHeader>
					<div className="flex flex-col gap-6 mt-6">
						{/* Theme Toggle */}
						<div className="flex flex-col gap-2">
							<label htmlFor="theme-toggle" className="text-sm font-medium">
								Theme
							</label>
							<ThemeToggle />
						</div>

						{/* Model Selector */}
						<div className="flex flex-col gap-2">
							<label htmlFor="model-select" className="text-sm font-medium">
								Model
							</label>
							<select
								id="model-select"
								value={selectedModel}
								onChange={(e) => send({ type: 'SELECT_MODEL', model: e.target.value })}
								className="border border-input rounded-lg px-3 py-2 bg-background text-sm"
								disabled={!connected}
							>
								<option value="haiku">Haiku</option>
								<option value="sonnet">Sonnet</option>
							</select>
						</div>

						{/* Session Selector */}
						<div className="flex flex-col gap-2">
							<label htmlFor="sessions-list" className="text-sm font-medium">
								Sessions
							</label>
							<div id="sessions-list" className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
								{sessions.map((session) => (
									<button
										type="button"
										key={session.id}
										onClick={() => {
											send({ type: 'SWITCH_SESSION', sessionId: session.id });
											setLeftSidebarOpen(false);
										}}
										className={cn(
											'text-left px-3 py-2 rounded-lg border transition-colors text-sm',
											session.id === currentSessionId
												? 'bg-primary text-primary-foreground border-primary'
												: 'bg-card border-input hover:bg-accent',
										)}
										disabled={!connected}
										title={`Session: ${session.id.substring(0, 8)} (${session.model})`}
									>
										<div className="font-medium">{session.id.substring(0, 8)}</div>
										<div className="text-xs opacity-70">{session.model}</div>
									</button>
								))}
							</div>
						</div>

						{/* Connection Status */}
						<div
							className={cn(
								'flex items-center gap-2 p-3 rounded-lg border',
								connected
									? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
									: isReconnecting
										? 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800'
										: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
							)}
						>
							<div
								className={cn(
									'w-2 h-2 rounded-full',
									connected
										? 'bg-green-600'
										: isReconnecting
											? 'bg-yellow-600 animate-pulse'
											: 'bg-red-600',
								)}
							/>
							<div className="flex flex-col">
								<span className="text-sm font-medium">
									{connected ? 'Connected' : isReconnecting ? 'Reconnecting...' : 'Disconnected'}
								</span>
								{isReconnecting && (
									<span className="text-xs opacity-70">Socket.IO will auto-reconnect</span>
								)}
							</div>
						</div>

						{/* Force Refresh - Development Tool */}
						<div className="flex flex-col gap-2">
							<label className="text-sm font-medium">Development</label>
							<Button
								variant="outline"
								size="sm"
								onClick={async () => {
									// Unregister service worker
									if ('serviceWorker' in navigator) {
										const registrations = await navigator.serviceWorker.getRegistrations();
										for (const registration of registrations) {
											await registration.unregister();
										}
									}
									// Clear all caches
									if ('caches' in window) {
										const cacheNames = await caches.keys();
										await Promise.all(cacheNames.map((name) => caches.delete(name)));
									}
									// Hard reload
									window.location.reload();
								}}
								className="w-full"
							>
								Force Refresh (Clear Cache)
							</Button>
						</div>
					</div>
				</SheetContent>
			</Sheet>

			{/* Right Sidebar - Logs */}
			<Sheet
				open={rightSidebarOpen}
				onOpenChange={(open) => {
					setRightSidebarOpen(open);
					if (!open) {
						send({ type: 'DESELECT_MESSAGE' });
					}
				}}
			>
				<SheetContent side="right" className="w-full sm:w-[400px]">
					<SheetHeader>
						<SheetTitle>Message Logs</SheetTitle>
					</SheetHeader>
					<div className="mt-6 bg-card border border-input rounded-xl p-4 h-[calc(100vh-180px)] overflow-y-auto font-mono text-xs">
						{!selectedMessage?.logs || selectedMessage.logs.length === 0 ? (
							<p className="text-muted-foreground">No logs available</p>
						) : (
							<div className="flex flex-col gap-2">
								{selectedMessage.logs.map((log, i) => {
									const logKey = `${i}-${log.substring(0, 50)}`;
									try {
										const parsed = JSON.parse(log);
										return (
											<div key={logKey} className="border-l-2 border-primary/30 pl-2">
												<div className="text-primary/60 text-[10px] mb-1">
													{parsed.type || 'unknown'}
													{parsed.subtype ? ` (${parsed.subtype})` : ''}
												</div>
												<pre className="text-muted-foreground overflow-x-auto whitespace-pre">
													{JSON.stringify(parsed, null, 2)}
												</pre>
											</div>
										);
									} catch {
										return (
											<div
												key={logKey}
												className="text-muted-foreground overflow-x-auto whitespace-pre"
											>
												{log}
											</div>
										);
									}
								})}
							</div>
						)}
					</div>
				</SheetContent>
			</Sheet>

			{/* Main Content */}
			<div className="h-full w-full flex flex-col">
				{/* Top Bar */}
				<div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
					<Button variant="ghost" size="icon" onClick={() => setLeftSidebarOpen(true)}>
						<Menu className="h-5 w-5" />
					</Button>

					<div className="flex-1 text-center">
						<h1 className="text-xl font-semibold">Good morning, Adam</h1>
					</div>

					<Button
						variant="ghost"
						size="icon"
						onClick={() => send({ type: 'CREATE_SESSION' })}
						disabled={!connected || state.matches('creatingSession')}
						className="h-10 w-10"
					>
						<Plus className="h-6 w-6" />
					</Button>
				</div>

				{/* Chat History */}
				<div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 min-h-0">
					{chatHistory.length === 0 ? (
						<div className="h-full flex items-center justify-center">
							<p className="text-muted-foreground text-sm">Send a message to start chatting...</p>
						</div>
					) : (
						<div className="flex flex-col gap-4 max-w-4xl mx-auto">
							{chatHistory.map((msg, i) => {
								const isInteractive = msg.role === 'assistant' && msg.logs;
								const msgKey = `${i}-${msg.role}-${msg.content.substring(0, 30)}`;
								return (
									<div
										key={msgKey}
										{...(isInteractive && {
											onClick: () => send({ type: 'SELECT_MESSAGE', index: i }),
											onKeyDown: (e: React.KeyboardEvent) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													send({ type: 'SELECT_MESSAGE', index: i });
												}
											},
											role: 'button',
											tabIndex: 0,
										})}
										className={cn(
											'p-4 rounded-xl',
											msg.role === 'user' ? 'bg-primary/10 ml-8' : 'bg-muted mr-8',
											isInteractive &&
												'cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all',
											selectedMessageIndex === i && 'ring-2 ring-primary',
										)}
									>
										<div className="flex items-center justify-between mb-2">
											<div className="text-xs font-semibold text-muted-foreground">
												{msg.role === 'user' ? 'You' : 'Claude'}
											</div>
											{msg.role === 'assistant' && msg.logs && (
												<div className="text-[10px] text-muted-foreground">
													{msg.logs.length} logs • click to view
												</div>
											)}
										</div>
										<MarkdownMessage content={msg.content} />
									</div>
								);
							})}
							{isLoading && (
								<div className="p-4 rounded-xl bg-muted mr-8">
									<div className="text-xs font-semibold mb-2 text-muted-foreground">Claude</div>
									<div className="text-sm text-muted-foreground">Thinking...</div>
									{currentLogs.length > 0 && (
										<div className="text-[10px] text-muted-foreground mt-2">
											{currentLogs.length} logs captured
										</div>
									)}
								</div>
							)}
						</div>
					)}
				</div>

				{/* Chat Input */}
				<div className="p-4 border-t border-border flex-shrink-0">
					<form onSubmit={sendMessage} className="max-w-4xl mx-auto relative">
						<textarea
							ref={messageInputRef}
							data-testid="chat-input"
							placeholder={connected ? 'How can I help you today?' : 'Waiting for connection...'}
							className="w-full pr-24 py-3 px-3 text-base rounded-lg border border-input bg-background resize-none min-h-[48px] max-h-[200px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={isLoading || !connected}
							rows={1}
							onKeyDown={(e) => {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault();
									const form = e.currentTarget.form;
									if (form) {
										form.requestSubmit();
									}
								}
							}}
						/>
						<div className="absolute right-2 bottom-2 flex gap-1">
							<MicButton onTranscribe={handleTranscribe} disabled={isLoading || !connected} />
							<Button
								type="submit"
								size="icon"
								disabled={isLoading || !connected}
								className="rounded-full"
							>
								→
							</Button>
						</div>
					</form>
				</div>
			</div>
		</>
	);
}
