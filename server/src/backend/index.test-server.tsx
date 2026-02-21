// Enable fake mode before importing server — avoids real Claude CLI calls in E2E tests
process.env.CLAUDE_TEST_FAKE = 'true';

import { startServer } from './server';

console.log('🧪 Starting test server with fake Claude responses...');
startServer();
