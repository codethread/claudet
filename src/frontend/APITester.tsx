import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useEffect, useRef, type FormEvent } from "react";
import { useMachine } from "@xstate/react";
import { chatMachine } from "./chatMachine";

export function APITester() {
  const [state, send] = useMachine(chatMachine, { input: undefined });
  const messageInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Connect to websocket for logs
  useEffect(() => {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      send({ type: "WEBSOCKET_CONNECTED" });
    };

    ws.onmessage = (event) => {
      console.log("WS message received:", event.data.substring(0, 50));
      send({ type: "WEBSOCKET_MESSAGE", data: event.data });
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      send({ type: "WEBSOCKET_ERROR", error: String(error) });
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      send({ type: "WEBSOCKET_DISCONNECTED" });
    };

    return () => {
      ws.close();
    };
  }, [send]);

  const sendMessage = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const message = messageInputRef.current!.value;
    if (!message.trim()) {
      return;
    }

    send({ type: "SEND_MESSAGE", message });
    messageInputRef.current!.value = "";
  };

  const { chatHistory, selectedMessageIndex, currentLogs } = state.context;
  const isConnected = state.matches("idle") || state.matches("sending");
  const isLoading = state.matches("sending");
  const selectedMessage = selectedMessageIndex !== null ? chatHistory[selectedMessageIndex] : null;

  return (
    <div className="h-full w-full text-left flex flex-col lg:flex-row gap-4 sm:gap-4">
      {/* Chat Panel */}
      <div className="flex-1 flex flex-col gap-4 sm:gap-4 min-h-0 pb-safe">
        <div className="flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-semibold">Chat with Claude</h2>
          <div className={cn("text-xs flex items-center gap-2 sm:gap-2", isConnected ? "text-green-600" : "text-red-600")}>
            <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-600" : "bg-red-600")} />
            <span className="hidden sm:inline">{isConnected ? "Connected" : "Disconnected"}</span>
          </div>
        </div>

        {/* Chat History */}
        <div className="flex-1 bg-card border border-input rounded-xl p-3 sm:p-4 overflow-y-auto min-h-0">
          {chatHistory.length === 0 ? (
            <p className="text-muted-foreground text-sm">Send a message to start chatting...</p>
          ) : (
            <div className="flex flex-col gap-4">
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  onClick={() => msg.role === "assistant" && msg.logs ? send({ type: "SELECT_MESSAGE", index: i }) : null}
                  className={cn(
                    "p-3 sm:p-3 rounded-lg",
                    msg.role === "user" ? "bg-primary/10 ml-4 sm:ml-8" : "bg-muted mr-4 sm:mr-8",
                    msg.role === "assistant" && msg.logs && "cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all",
                    selectedMessageIndex === i && "ring-2 ring-primary"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs font-semibold text-muted-foreground">
                      {msg.role === "user" ? "You" : "Claude"}
                    </div>
                    {msg.role === "assistant" && msg.logs && (
                      <div className="text-[10px] text-muted-foreground">
                        {msg.logs.length} logs • click to view
                      </div>
                    )}
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                </div>
              ))}
              {isLoading && (
                <div className="p-3 sm:p-3 rounded-lg bg-muted mr-4 sm:mr-8">
                  <div className="text-xs font-semibold mb-1 text-muted-foreground">Claude</div>
                  <div className="text-sm text-muted-foreground">Thinking...</div>
                  {currentLogs.length > 0 && (
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {currentLogs.length} logs captured
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat Input */}
        <form onSubmit={sendMessage} className="flex gap-2 sm:gap-2 flex-shrink-0">
          <Input
            ref={messageInputRef}
            type="text"
            placeholder={isConnected ? "Type your message..." : "Waiting for connection..."}
            className="flex-1"
            disabled={isLoading || !isConnected}
          />
          <Button type="submit" disabled={isLoading || !isConnected}>
            Send
          </Button>
        </form>
      </div>

      {/* Side Panel for Logs */}
      {selectedMessage && (
        <div className="w-full lg:w-[500px] flex flex-col gap-4 sm:gap-4 animate-in slide-in-from-right duration-200 min-h-0 lg:min-h-full">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-semibold">Message Logs</h2>
            <Button variant="ghost" size="sm" onClick={() => send({ type: "DESELECT_MESSAGE" })}>
              ✕
            </Button>
          </div>

          <div className="bg-card border border-input rounded-xl p-3 sm:p-3 flex-1 overflow-y-auto font-mono text-xs">
            {!selectedMessage.logs || selectedMessage.logs.length === 0 ? (
              <p className="text-muted-foreground">No logs available</p>
            ) : (
              <div className="flex flex-col gap-2">
                {selectedMessage.logs.map((log, i) => {
                  // Try to parse as JSON for pretty formatting
                  try {
                    const parsed = JSON.parse(log);
                    return (
                      <div key={i} className="border-l-2 border-primary/30 pl-2">
                        <div className="text-primary/60 text-[10px] mb-1">
                          {parsed.type || "unknown"}{parsed.subtype ? ` (${parsed.subtype})` : ""}
                        </div>
                        <pre className="text-muted-foreground overflow-x-auto whitespace-pre">
                          {JSON.stringify(parsed, null, 2)}
                        </pre>
                      </div>
                    );
                  } catch {
                    // Not JSON, display as-is
                    return (
                      <div key={i} className="text-muted-foreground overflow-x-auto whitespace-pre">
                        {log}
                      </div>
                    );
                  }
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
