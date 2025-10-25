import { serve } from "bun";
import index from "./index.html";
import qrcode from "qrcode-terminal";
import { networkInterfaces } from "os";

// Get local network IP address
function getLocalIP(): string {
  const nets = networkInterfaces();

  for (const name of Object.keys(nets)) {
    const interfaces = nets[name];
    if (!interfaces) continue;

    for (const net of interfaces) {
      // Skip internal (localhost) and non-IPv4 addresses
      const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
      if (net.family === familyV4Value && !net.internal) {
        return net.address;
      }
    }
  }

  return 'localhost';
}

// Start a persistent Claude session with streaming JSON I/O
const claudeProcess = Bun.spawn(
  [
    "claude",
    "--print",
    "--verbose",
    "--input-format=stream-json",
    "--output-format=stream-json",
    "--model=haiku",
  ],
  {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  }
);

console.log("🤖 Claude session started");

// Keep track of pending requests
const pendingRequests = new Map<string, {
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  buffer: string;
  sessionId?: string;
  logs: string[];
}>();

// Track websocket clients for log streaming
const logClients = new Set<any>();

// Buffer logs per session ID
const sessionLogs = new Map<string, string[]>();

// Read Claude's output stream
const reader = claudeProcess.stdout.getReader();
const decoder = new TextDecoder();

async function readClaudeOutput() {
  try {
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        console.log(`[Claude Log] ${line.substring(0, 100)}... (clients: ${logClients.size})`);

        // Broadcast raw log line to all connected websocket clients
        for (const client of logClients) {
          try {
            client.send(line);
          } catch (e) {
            console.error("Failed to send to client:", e);
            logClients.delete(client);
          }
        }

        try {
          const data = JSON.parse(line);

          // Store logs for this session
          if (data.session_id) {
            if (!sessionLogs.has(data.session_id)) {
              sessionLogs.set(data.session_id, []);
            }
            sessionLogs.get(data.session_id)!.push(line);
          }

          // Handle assistant message response
          if (data.type === "assistant" && data.session_id) {
            const requests = Array.from(pendingRequests.values());
            const pending = requests.find(r => r.sessionId === data.session_id);

            if (pending && data.message?.content?.[0]?.text) {
              pending.buffer += data.message.content[0].text;
            }
          }
          // Handle result message (final)
          else if (data.type === "result" && data.session_id) {
            const requests = Array.from(pendingRequests.entries());
            const entry = requests.find(([_, r]) => r.sessionId === data.session_id);

            if (entry) {
              const [messageId, pending] = entry;

              // Attach logs from this session
              const logs = sessionLogs.get(data.session_id) || [];
              pending.logs = logs;

              if (data.is_error) {
                pending.reject(new Error(data.result || "Unknown error"));
              } else {
                pending.resolve(pending.buffer || data.result);
              }

              pendingRequests.delete(messageId);
              // Clean up session logs
              sessionLogs.delete(data.session_id);
            }
          }
          // Store session ID from init message
          else if (data.type === "system" && data.subtype === "init" && data.session_id) {
            // Find the most recent pending request without a session ID
            for (const pending of pendingRequests.values()) {
              if (!pending.sessionId) {
                pending.sessionId = data.session_id;
                break;
              }
            }
          }
        } catch (e) {
          console.error("Failed to parse Claude output:", line, e);
        }
      }
    }
  } catch (error) {
    console.error("Error reading Claude output:", error);
  }
}

// Start reading output
readClaudeOutput();

// Function to send a message to Claude
async function sendToClaude(message: string): Promise<{ response: string; logs: string[] }> {
  const messageId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const request = {
      resolve: (response: string) => {
        // Retrieve logs from the request object
        const logs = request.logs || [];
        resolve({ response, logs });
      },
      reject,
      buffer: "",
      logs: [] as string[],
    };

    pendingRequests.set(messageId, request as any);

    // Send message in stream-json format
    const input = JSON.stringify({
      type: "user",
      message: {
        role: "user",
        content: message,
      },
    }) + "\n";

    claudeProcess.stdin.write(input);

    // Set a timeout
    setTimeout(() => {
      if (pendingRequests.has(messageId)) {
        const pending = pendingRequests.get(messageId)!;
        pendingRequests.delete(messageId);
        reject(new Error("Request timeout"));
      }
    }, 60000); // 60 second timeout
  });
}

const server = serve({
  hostname: "0.0.0.0", // Listen on all network interfaces
  port: 3000,

  websocket: {
    open(ws) {
      logClients.add(ws);
      console.log("✅ WebSocket client connected. Total clients:", logClients.size);
      // Send a test message to confirm connection
      ws.send(JSON.stringify({ type: "connection", status: "connected", timestamp: new Date().toISOString() }));
    },
    message(ws, message) {
      console.log("📨 WebSocket received message:", message);
      // Echo back for now (can add commands later)
      ws.send(`Echo: ${message}`);
    },
    close(ws) {
      logClients.delete(ws);
      console.log("❌ WebSocket client disconnected. Total clients:", logClients.size);
    },
  },

  routes: {
    "/ws": {
      async GET(req, server) {
        const success = server.upgrade(req);
        if (success) {
          return undefined;
        }
        return new Response("WebSocket upgrade failed", { status: 500 });
      },
    },

    // Serve index.html for all unmatched routes.
    "/*": index,

    "/api/hello": {
      async GET(req) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT(req) {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async req => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },

    "/api/chat": {
      async POST(req) {
        try {
          const body = await req.json();
          const message = body.message;

          if (!message) {
            return Response.json(
              { error: "Message is required" },
              { status: 400 }
            );
          }

          const { response, logs } = await sendToClaude(message);

          return Response.json({
            response,
            logs,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error("Error in /api/chat:", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
          );
        }
      },
    },

    "/api/greet": {
      async GET(req) {
        const proc = Bun.spawn(["claude", "--print", "--model=haiku", "Say hello"], {
          stdout: "pipe",
          stderr: "pipe",
        });

        const output = await new Response(proc.stdout).text();
        const error = await new Response(proc.stderr).text();
        await proc.exited;

        return Response.json({
          output,
          error,
          exitCode: proc.exitCode,
        });
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

const localIP = getLocalIP();
const port = server.port;

console.log("\n" + "=".repeat(50));
console.log("🚀 Server running!");
console.log("=".repeat(50));
console.log(`\n📍 Local:   ${server.url}`);
console.log(`📱 Network: http://${localIP}:${port}\n`);

// Generate QR code for the network URL
const networkURL = `http://${localIP}:${port}`;
console.log("📱 Scan QR code to open on your phone:\n");
qrcode.generate(networkURL, { small: true });

console.log("\n" + "=".repeat(50) + "\n");
