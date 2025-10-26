import index from "../frontend/index.html";
import qrcode from "qrcode-terminal";
import { networkInterfaces } from "os";
import { createActor } from "xstate";
import {
  claudeRunnerMachine,
  createClaudeRunnerMachine,
  type ClaudeResponse,
  type ClaudeRunnerMachine,
} from "./claudeRunner";
import type { ClaudeCodeService } from "./services/ClaudeCodeService";

// Get local network IP address
function getLocalIP(): string {
  const nets = networkInterfaces();

  for (const name of Object.keys(nets)) {
    const interfaces = nets[name];
    if (!interfaces) continue;

    for (const net of interfaces) {
      // Skip internal (localhost) and non-IPv4 addresses
      const familyV4Value = typeof net.family === "string" ? "IPv4" : 4;
      if (net.family === familyV4Value && !net.internal) {
        return net.address;
      }
    }
  }

  return "localhost";
}

// Module-level actor (can be overridden via startServer)
let claudeActor: ReturnType<typeof createActor<ClaudeRunnerMachine>>;
let isReading = false; // Track if we're already reading output

function initializeActor(machine: ClaudeRunnerMachine) {
  // Stop existing actor if any
  if (claudeActor) {
    try {
      claudeActor.stop();
    } catch (e) {
      // Ignore errors on stop
    }
  }

  isReading = false; // Reset reading flag
  claudeActor = createActor(machine);
  claudeActor.start();
  claudeActor.send({ type: "START_PROCESS" });
  console.log("🤖 Claude session starting...");

  // Start reading output after a short delay
  setTimeout(() => {
    if (!isReading) {
      readClaudeOutput();
    }
  }, 100);
}

// Initialize with default production machine
initializeActor(claudeRunnerMachine);

// Start reading Claude output in the background
async function readClaudeOutput() {
  if (isReading) {
    console.log("Already reading Claude output, skipping...");
    return;
  }

  isReading = true;

  try {
    // Wait a bit for process handle to be ready
    await new Promise(resolve => setTimeout(resolve, 200));

    const context = claudeActor.getSnapshot().context;
    if (!context.processHandle) {
      console.error("No process handle available");
      isReading = false;
      return;
    }

    const reader = context.processHandle.stdout.getReader();
    const decoder = new TextDecoder();
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

        console.log(
          `[Claude Log] ${line.substring(0, 100)}... (clients: ${claudeActor.getSnapshot().context.logClients.size})`,
        );

        // Send the output line to the state machine
        claudeActor.send({ type: "OUTPUT_LINE", line });
      }
    }
  } catch (error) {
    console.error("Error reading Claude output:", error);
    claudeActor.send({ type: "PROCESS_ERROR", error: String(error) });
  } finally {
    isReading = false;
  }
}

// Function to send a message to Claude
async function sendToClaude(message: string): Promise<ClaudeResponse> {
  const messageId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    // Send the message first so the state machine creates the pending request
    claudeActor.send({
      type: "SEND_MESSAGE",
      message,
      messageId,
    });

    // Poll for the request to be created (XState actions run synchronously)
    const maxAttempts = 10;
    let attempts = 0;

    const checkRequest = () => {
      const context = claudeActor.getSnapshot().context;
      const request = context.pendingRequests.get(messageId);

      if (request) {
        request.resolve = resolve;
        request.reject = reject;
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkRequest, 10);
      } else {
        reject(new Error("Failed to create request - pending request not found after multiple attempts"));
      }
    };

    // Start checking immediately
    checkRequest();

    // Set a timeout
    setTimeout(() => {
      const currentContext = claudeActor.getSnapshot().context;
      if (currentContext.pendingRequests.has(messageId)) {
        currentContext.pendingRequests.delete(messageId);
        reject(new Error("Request timeout"));
      }
    }, 60000); // 60 second timeout
  });
}

export interface StartServerOptions {
  /**
   * Optional ClaudeCodeService for dependency injection (testing)
   */
  service?: ClaudeCodeService;
}

export function startServer(options: StartServerOptions = {}) {
  // If a custom service is provided, reinitialize the actor
  if (options.service) {
    const customMachine = createClaudeRunnerMachine(options.service);
    initializeActor(customMachine);
  }
  const server = Bun.serve({
    hostname: "0.0.0.0", // Listen on all network interfaces
    port: 3000,
    idleTimeout: 120, // 120 seconds to allow for longer Claude responses
    tls: {
      cert: Bun.file("./certs/localhost+3.pem"),
      key: Bun.file("./certs/localhost+3-key.pem"),
    },

    websocket: {
      open(ws) {
        claudeActor.send({ type: "REGISTER_WS_CLIENT", client: ws });
        console.log(
          "✅ WebSocket client connected. Total clients:",
          claudeActor.getSnapshot().context.logClients.size,
        );
        // Send a test message to confirm connection
        ws.send(
          JSON.stringify({
            type: "connection",
            status: "connected",
            timestamp: new Date().toISOString(),
          }),
        );
      },
      message(ws, message) {
        console.log("📨 WebSocket received message:", message);
        // Echo back for now (can add commands later)
        ws.send(`Echo: ${message}`);
      },
      close(ws) {
        claudeActor.send({ type: "UNREGISTER_WS_CLIENT", client: ws });
        console.log(
          "❌ WebSocket client disconnected. Total clients:",
          claudeActor.getSnapshot().context.logClients.size,
        );
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

      "/sw.js": Bun.file("./src/frontend/sw.js"),
      "/src/manifest.json": Bun.file("./src/frontend/manifest.json"),
      "/logo.svg": Bun.file("./src/frontend/assets/logo.svg"),
      "/icon-180.png": Bun.file("./src/frontend/assets/icon-180.png"),
      "/icon-192.png": Bun.file("./src/frontend/assets/icon-192.png"),
      "/icon-512.png": Bun.file("./src/frontend/assets/icon-512.png"),

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

      "/api/hello/:name": async (req) => {
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
                { status: 400 },
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
              { status: 500 },
            );
          }
        },
      },

      "/api/greet": {
        async GET(req) {
          const proc = Bun.spawn(
            ["claude", "--print", "--model=haiku", "Say hello"],
            {
              stdout: "pipe",
              stderr: "pipe",
            },
          );

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
  console.log(`📱 Network: https://${localIP}:${port}\n`);

  // Generate QR code for the network URL
  const networkURL = `https://${localIP}:${port}`;
  console.log("📱 Scan QR code to open on your phone:\n");
  qrcode.generate(networkURL, { small: true });

  console.log("\n" + "=".repeat(50) + "\n");

  return server;
}
