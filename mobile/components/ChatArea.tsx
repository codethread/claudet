import { useRef, useEffect } from 'react';
import {
  Animated,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Text,
  useColorScheme,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { ChatMessage } from './ChatMessage';
import type { Message } from '../types';

function friendlyError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('rate limit') || lower.includes('429') || lower.includes('too many requests')) {
    return 'Rate limit reached — please wait a moment before sending another message.';
  }
  const match = raw.match(/claude exited with code \d+:\s*([\s\S]+)/i);
  return match ? match[1].trim() : raw.replace(/^Error:\s*/i, '');
}

interface Props {
  messages: Message[];
  loading: boolean;
  loadingMessages: boolean;
  error: string | null;
  onDismissError: () => void;
  scrollRef: React.RefObject<ScrollView | null>;
  showScrollButton: boolean;
  onScrollToBottom: () => void;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  bottomOffset: number;
}

export function ChatArea({
  messages,
  loading,
  loadingMessages,
  error,
  onDismissError,
  scrollRef,
  showScrollButton,
  onScrollToBottom,
  onScroll,
  bottomOffset,
}: Props) {
  const isDark = useColorScheme() === 'dark';
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!showScrollButton) return;
    bounceAnim.setValue(0);
    Animated.sequence([
      Animated.timing(bounceAnim, { toValue: 7, duration: 140, useNativeDriver: true }),
      Animated.timing(bounceAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(bounceAnim, { toValue: 4, duration: 110, useNativeDriver: true }),
      Animated.timing(bounceAnim, { toValue: 0, duration: 110, useNativeDriver: true }),
    ]).start();
  }, [showScrollButton, bounceAnim]);

  return (
    <>
      {error ? (
        <View className="flex-row items-start bg-red-950 px-4 py-3 gap-2">
          <Text className="flex-1 text-red-400 text-[13px] leading-[18px]" numberOfLines={3}>
            ⚠ {friendlyError(error)}
          </Text>
          <Pressable onPress={onDismissError} hitSlop={8}>
            <Text className="text-red-400 text-[15px] font-bold pt-[1px]">✕</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 4 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScroll={onScroll}
        scrollEventThrottle={100}
      >
        {messages.length === 0 && !error && (
          <Text className={`text-center mt-10 text-[15px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
            {loadingMessages ? 'Loading messages…' : 'Send a message to start chatting'}
          </Text>
        )}
        {messages.map((msg, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: messages are append-only, index is stable
          <ChatMessage key={i} message={msg} />
        ))}
        {loading && (
          <View className="flex-row items-center gap-2 py-1 self-start">
            <ActivityIndicator size="small" color={isDark ? '#8e8e93' : '#666'} />
            <Text className={`text-[14px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
              Thinking...
            </Text>
          </View>
        )}
      </ScrollView>

      {showScrollButton && (
        <Animated.View
          style={[
            { position: 'absolute', left: 0, right: 0, alignItems: 'center', bottom: bottomOffset },
            { transform: [{ translateY: bounceAnim }] },
          ]}
        >
          <Pressable
            onPress={onScrollToBottom}
            className="w-10 h-10 rounded-full bg-[#007AFF] items-center justify-center shadow-lg"
            style={{ elevation: 5 }}
          >
            <Text className="text-white text-xl font-bold leading-6">↓</Text>
          </Pressable>
        </Animated.View>
      )}
    </>
  );
}
