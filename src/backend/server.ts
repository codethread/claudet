import index from "../frontend/index.html";
import qrcode from "qrcode-terminal";
import { networkInterfaces } from "os";
import { existsSync } from "fs";
import { RealClaudeCodeService } from "./services";
import type { ClaudeCodeService } from "./services/ClaudeCodeService";
import { SessionManager } from "./SessionManager";
import type { ClaudeResponse } from "./claudeRunner";

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

// Module-level session manager
let sessionManager: SessionManager;
const sessionReaders = new Map<string, boolean>(); // Track which sessions are being read

function initializeSessionManager(service: ClaudeCodeService) {
  sessionManager = new SessionManager(service);
  // Create a default session
  const defaultSession = sessionManager.createSession();
  defaultSession.actor.send({ type: "START_PROCESS" });
  console.log(`🤖 Default Claude session created: ${defaultSession.id}`);

  // Start reading output for this session
  setTimeout(() => {
    readSessionOutput(defaultSession.id);
  }, 100);
}

// Initialize with default production service
initializeSessionManager(new RealClaudeCodeService());

// Start reading Claude output for a specific session
async function readSessionOutput(sessionId: string) {
  if (sessionReaders.get(sessionId)) {
    console.log(`Already reading output for session ${sessionId}, skipping...`);
    return;
  }

  sessionReaders.set(sessionId, true);

  try {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      console.error(`Session ${sessionId} not found`);
      sessionReaders.delete(sessionId);
      return;
    }

    // Wait a bit for process handle to be ready
    await new Promise((resolve) => setTimeout(resolve, 200));

    const context = session.actor.getSnapshot().context;
    if (!context.processHandle) {
      console.error(`No process handle available for session ${sessionId}`);
      sessionReaders.delete(sessionId);
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
          `[Session ${sessionId.substring(0, 8)}] ${line.substring(0, 100)}...`,
        );

        // Send the output line to the state machine
        session.actor.send({ type: "OUTPUT_LINE", line });
      }
    }
  } catch (error) {
    console.error(`Error reading output for session ${sessionId}:`, error);
    const session = sessionManager.getSession(sessionId);
    if (session) {
      session.actor.send({ type: "PROCESS_ERROR", error: String(error) });
    }
  } finally {
    sessionReaders.delete(sessionId);
  }
}

// Function to send a message to a specific Claude session
async function sendToClaude(
  sessionId: string,
  message: string,
): Promise<ClaudeResponse> {
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const messageId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    // Send the message first so the state machine creates the pending request
    session.actor.send({
      type: "SEND_MESSAGE",
      message,
      messageId,
    });

    // Poll for the request to be created (XState actions run synchronously)
    const maxAttempts = 10;
    let attempts = 0;

    const checkRequest = () => {
      const context = session.actor.getSnapshot().context;
      const request = context.pendingRequests.get(messageId);

      if (request) {
        request.resolve = resolve;
        request.reject = reject;
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkRequest, 10);
      } else {
        reject(
          new Error(
            "Failed to create request - pending request not found after multiple attempts",
          ),
        );
      }
    };

    // Start checking immediately
    checkRequest();

    // Set a timeout
    setTimeout(() => {
      const currentContext = session.actor.getSnapshot().context;
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
  // If a custom service is provided, reinitialize the session manager
  if (options.service) {
    initializeSessionManager(options.service);
  }

  // Check if certificates exist
  if (
    !existsSync("./certs/localhost+3.pem") ||
    !existsSync("./certs/localhost+3-key.pem")
  ) {
    console.error("\n❌ HTTPS certificates not found!");
    console.error("📋 Run the following command to generate them:\n");
    console.error("   bun run setup\n");
    console.error(
      "   (or just: bun run generate:certs if you only need certificates)\n",
    );
    process.exit(1);
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
        // Register this client with all sessions
        // Note: In a production app, you'd want to track which sessions
        // the client is subscribed to, but for simplicity we'll broadcast to all
        const sessions = sessionManager.listSessions();
        for (const { id } of sessions) {
          const session = sessionManager.getSession(id);
          if (session) {
            session.actor.send({ type: "REGISTER_WS_CLIENT", client: ws });
          }
        }

        console.log("✅ WebSocket client connected");

        // Send connection confirmation with list of sessions
        ws.send(
          JSON.stringify({
            type: "connection",
            status: "connected",
            sessions: sessions.map((s) => ({
              id: s.id,
              model: s.model,
              createdAt: s.createdAt,
            })),
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
        // Unregister from all sessions
        const sessions = sessionManager.listSessions();
        for (const { id } of sessions) {
          const session = sessionManager.getSession(id);
          if (session) {
            session.actor.send({ type: "UNREGISTER_WS_CLIENT", client: ws });
          }
        }
        console.log("❌ WebSocket client disconnected");
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
      "/icon-180.png": Bun.file("./src/frontend/assets/gen/icon-180.png"),
      "/icon-192.png": Bun.file("./src/frontend/assets/gen/icon-192.png"),
      "/icon-512.png": Bun.file("./src/frontend/assets/gen/icon-512.png"),

      // Serve index.html for all unmatched routes.
      "/*": index,

      "/api/models": {
        async GET(req) {
          const { getDefaultModel } = await import(
            "./services/ClaudeCodeService"
          );
          return Response.json({
            models: ["haiku", "sonnet"],
            default: getDefaultModel(),
          });
        },
      },

      "/api/sessions": {
        async GET(req) {
          try {
            const sessions = sessionManager.listSessions();
            return Response.json({
              sessions: sessions.map((s) => ({
                id: s.id,
                model: s.model,
                createdAt: s.createdAt,
              })),
            });
          } catch (error) {
            console.error("Error in GET /api/sessions:", error);
            return Response.json(
              {
                error: error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 },
            );
          }
        },
        async POST(req) {
          try {
            const body = await req.json().catch(() => ({}));
            const model = body.model; // Optional: "haiku", "sonnet", or "opus"

            const session = sessionManager.createSession(model);
            session.actor.send({ type: "START_PROCESS" });
            console.log(
              `🤖 New Claude session created: ${session.id} (model: ${session.model})`,
            );

            // Start reading output for this new session
            setTimeout(() => {
              readSessionOutput(session.id);
            }, 100);

            return Response.json({
              id: session.id,
              model: session.model,
              createdAt: session.createdAt,
            });
          } catch (error) {
            console.error("Error in POST /api/sessions:", error);
            return Response.json(
              {
                error: error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 },
            );
          }
        },
      },

      "/api/chat": {
        async POST(req) {
          try {
            const body = await req.json();
            const message = body.message;
            const sessionId = body.sessionId;

            if (!message) {
              return Response.json(
                { error: "Message is required" },
                { status: 400 },
              );
            }

            // If no sessionId provided, use the default session
            let targetSessionId = sessionId;
            if (!targetSessionId) {
              const defaultSession = sessionManager.getOrCreateDefaultSession();
              targetSessionId = defaultSession.id;
            }

            const { response, logs } = await sendToClaude(
              targetSessionId,
              message,
            );

            return Response.json({
              response,
              logs,
              sessionId: targetSessionId,
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            console.error("Error in /api/chat:", error);
            return Response.json(
              {
                error: error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 },
            );
          }
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
