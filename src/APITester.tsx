import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState, type FormEvent } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  logs?: string[];
}

export function APITester() {
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [selectedMessageIndex, setSelectedMessageIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentLogs, setCurrentLogs] = useState<string[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const collectingLogsRef = useRef(false);

  // Connect to websocket for logs
  useEffect(() => {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      console.log("WS message received:", event.data.substring(0, 50), "collecting:", collectingLogsRef.current);
      // Collect logs while a message is being processed
      if (collectingLogsRef.current) {
        setCurrentLogs((prev) => [...prev, event.data]);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setWsConnected(false);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      setWsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setCurrentLogs([]); // Reset logs for new message
    collectingLogsRef.current = true; // Start collecting logs (for live display)

    const message = messageInputRef.current!.value;
    if (!message.trim()) {
      setIsLoading(false);
      collectingLogsRef.current = false;
      return;
    }

    try {
      setChatHistory((prev) => [...prev, { role: "user", content: message }]);
      messageInputRef.current!.value = "";

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();

      // Stop collecting logs
      collectingLogsRef.current = false;

      // Add assistant message with logs from the API response
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: data.response, logs: data.logs || [] },
      ]);
    } catch (error) {
      collectingLogsRef.current = false;

      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${error}`, logs: [] },
      ]);
    } finally {
      setIsLoading(false);
      setCurrentLogs([]);
    }
  };

  const selectedMessage = selectedMessageIndex !== null ? chatHistory[selectedMessageIndex] : null;

  return (
    <div className="mt-8 mx-auto w-full max-w-6xl text-left flex gap-4">
      {/* Chat Panel */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Chat with Claude</h2>
          <div className={cn("text-xs flex items-center gap-2", wsConnected ? "text-green-600" : "text-red-600")}>
            <div className={cn("w-2 h-2 rounded-full", wsConnected ? "bg-green-600" : "bg-red-600")} />
            {wsConnected ? "Connected" : "Disconnected"}
          </div>
        </div>

        {/* Chat History */}
        <div className="flex-1 bg-card border border-input rounded-xl p-4 min-h-[400px] max-h-[500px] overflow-y-auto">
          {chatHistory.length === 0 ? (
            <p className="text-muted-foreground text-sm">Send a message to start chatting...</p>
          ) : (
            <div className="flex flex-col gap-3">
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  onClick={() => msg.role === "assistant" && msg.logs ? setSelectedMessageIndex(i) : null}
                  className={cn(
                    "p-3 rounded-lg",
                    msg.role === "user" ? "bg-primary/10 ml-8" : "bg-muted mr-8",
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
                <div className="p-3 rounded-lg bg-muted mr-8">
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
        <form onSubmit={sendMessage} className="flex gap-2">
          <Input
            ref={messageInputRef}
            type="text"
            placeholder={wsConnected ? "Type your message..." : "Waiting for connection..."}
            className="flex-1"
            disabled={isLoading || !wsConnected}
          />
          <Button type="submit" disabled={isLoading || !wsConnected}>
            Send
          </Button>
        </form>
      </div>

      {/* Side Panel for Logs */}
      {selectedMessage && (
        <div className="w-[500px] flex flex-col gap-4 animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Message Logs</h2>
            <Button variant="ghost" size="sm" onClick={() => setSelectedMessageIndex(null)}>
              ✕
            </Button>
          </div>

          <div className="bg-card border border-input rounded-xl p-3 min-h-[400px] max-h-[500px] overflow-y-auto font-mono text-xs">
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
