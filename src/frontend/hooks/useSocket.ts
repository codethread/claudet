import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

/**
 * Simplified WebSocket hook using Socket.IO.
 *
 * Socket.IO handles reconnection automatically with exponential backoff,
 * eliminating the need for custom reconnection logic.
 *
 * Key features:
 * - Auto-reconnect with exponential backoff (built-in)
 * - Built-in ping/pong heartbeat mechanism
 * - Test environment detection (suppresses errors in tests)
 * - iOS Safari support via visibilitychange event
 * - Clean API: { socket, connected, error }
 */

export interface UseSocketOptions {
  /** Socket.IO connection URL (default: "/") */
  url?: string;
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
}

export interface UseSocketReturn {
  /** Socket.IO client instance (null before connection) */
  socket: Socket | null;
  /** Connection state (true when connected) */
  connected: boolean;
  /** Error message (null if no error) */
  error: string | null;
}

/**
 * Detect if we're running in a test environment (Playwright, etc.)
 */
function isTestEnvironment(): boolean {
  return (
    typeof navigator !== "undefined" && navigator.webdriver === true
  );
}

/**
 * Hook for Socket.IO connection with automatic reconnection.
 *
 * @example
 * ```tsx
 * const { socket, connected, error } = useSocket({ url: "/" });
 *
 * useEffect(() => {
 *   if (!socket) return;
 *
 *   socket.on("message", (data) => {
 *     console.log("Received:", data);
 *   });
 *
 *   return () => {
 *     socket.off("message");
 *   };
 * }, [socket]);
 * ```
 */
export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { url = "/", autoConnect = true } = options;

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const isTestMode = isTestEnvironment();

  useEffect(() => {
    if (!autoConnect) return;

    // Create Socket.IO client with reconnection config
    const socket = io(url, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: Infinity, // Keep trying in production
      timeout: 10000,
      transports: ["websocket"], // Prefer WebSocket over polling
    });

    socketRef.current = socket;

    // Connection opened
    socket.on("connect", () => {
      setConnected(true);
      setError(null);
      if (!isTestMode) {
        console.log("Socket.IO connected:", socket.id);
      }
    });

    // Connection closed
    socket.on("disconnect", (reason) => {
      setConnected(false);
      if (!isTestMode) {
        console.log("Socket.IO disconnected:", reason);
      }
      // Socket.IO will auto-reconnect unless reason is "io client disconnect"
    });

    // Connection error
    socket.on("connect_error", (err) => {
      setError(err.message);
      // Suppress error logging in test mode to reduce spam
      if (!isTestMode) {
        console.error("Socket.IO connection error:", err.message);
      }
    });

    // Reconnection attempt
    socket.io.on("reconnect_attempt", (attempt) => {
      if (!isTestMode) {
        console.log(`Socket.IO reconnect attempt ${attempt}`);
      }
    });

    // Reconnection successful
    socket.io.on("reconnect", (attempt) => {
      setError(null);
      if (!isTestMode) {
        console.log(`Socket.IO reconnected after ${attempt} attempts`);
      }
    });

    // iOS Safari: Force reconnect when page becomes visible
    // iOS Safari suspends JavaScript execution when the device locks or app backgrounds,
    // which can leave WebSocket connections in a zombie state. The visibilitychange
    // event is the most reliable way to detect when the page becomes visible again.
    const handleVisibilityChange = () => {
      if (!document.hidden && !socket.connected) {
        if (!isTestMode) {
          console.log("Page visible and disconnected, forcing reconnect...");
        }
        socket.connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup on unmount
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      socket.close();
      socketRef.current = null;
    };
  }, [url, autoConnect, isTestMode]);

  return {
    socket: socketRef.current,
    connected,
    error,
  };
}
