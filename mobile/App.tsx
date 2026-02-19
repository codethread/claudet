import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Constants from 'expo-constants';

// Auto-derive server host from the Expo dev server (same machine).
// Falls back to localhost for simulators.
function getServerUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoClient?.hostUri;
  const host = hostUri ? hostUri.split(':')[0] : 'localhost';
  return `http://${host}:3001`;
}

const SERVER_URL = getServerUrl();

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Create a session on mount
  useEffect(() => {
    fetch(`${SERVER_URL}/api/sessions`, { method: 'POST' })
      .then((r) => r.json())
      .then((data: { id: string }) => setSessionId(data.id))
      .catch((e: Error) => setError(`Failed to connect: ${e.message}`));
  }, []);

  const send = async () => {
    if (!input.trim() || !sessionId || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${SERVER_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, sessionId }),
      });
      const data = (await res.json()) as { response?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Unknown error');
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response ?? '' }]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(`Error: ${msg}`);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="auto" />

      <View style={styles.header}>
        <Text style={styles.headerText}>Claudet</Text>
        <Text style={styles.statusText}>
          {sessionId ? '● Connected' : error ? '● Error' : '○ Connecting...'}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.length === 0 && (
          <Text style={styles.emptyText}>Send a message to start chatting</Text>
        )}
        {messages.map((msg, i) => (
          <View
            key={i}
            style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.assistantBubble]}
          >
            <Text style={styles.bubbleText}>{msg.content}</Text>
          </View>
        ))}
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#666" />
            <Text style={styles.loadingText}>Thinking...</Text>
          </View>
        )}
        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          multiline
          editable={!!sessionId && !loading}
          onSubmitEditing={send}
        />
        <Pressable
          style={[styles.sendButton, (!sessionId || loading || !input.trim()) && styles.sendButtonDisabled]}
          onPress={send}
          disabled={!sessionId || loading || !input.trim()}
        >
          <Text style={styles.sendButtonText}>→</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerText: {
    fontSize: 20,
    fontWeight: '700',
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
  },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  bubbleText: {
    fontSize: 15,
    color: '#000',
    lineHeight: 20,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  loadingText: {
    color: '#666',
    fontSize: 14,
  },
  errorText: {
    color: '#cc0000',
    fontSize: 13,
    paddingVertical: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#000',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
