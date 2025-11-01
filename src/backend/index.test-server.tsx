import { startServer } from './server';
import { FakeClaudeCodeService } from './services/FakeClaudeCodeService';

// Start the server with fake Claude service for E2E tests
console.log('🧪 Starting test server with FakeClaudeCodeService...');
startServer({
	service: new FakeClaudeCodeService(),
});
