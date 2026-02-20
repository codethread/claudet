import { useRef, useEffect } from 'react';
import {
	Animated,
	StyleSheet,
	Text,
	View,
	ScrollView,
	ActivityIndicator,
	Pressable,
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
	// Strip the leading "Error: Claude exited with code N: " prefix if present
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

	const emptyColor = isDark ? '#636366' : '#999';
	const loadingColor = isDark ? '#8e8e93' : '#666';

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
				<View style={styles.errorBanner}>
					<Text style={styles.errorBannerText} numberOfLines={3}>
						⚠ {friendlyError(error)}
					</Text>
					<Pressable onPress={onDismissError} hitSlop={8} style={styles.errorDismiss}>
						<Text style={styles.errorDismissText}>✕</Text>
					</Pressable>
				</View>
			) : null}

			<ScrollView
				ref={scrollRef}
				style={styles.scroll}
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="on-drag"
				onScroll={onScroll}
				scrollEventThrottle={100}
			>
				{messages.length === 0 && !error && (
					<Text style={[styles.empty, { color: emptyColor }]}>
						{loadingMessages ? 'Loading messages…' : 'Send a message to start chatting'}
					</Text>
				)}
				{messages.map((msg, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: messages are append-only, index is stable
					<ChatMessage key={i} message={msg} />
				))}
				{loading && (
					<View style={styles.loadingRow}>
						<ActivityIndicator size="small" color={loadingColor} />
						<Text style={[styles.loadingText, { color: loadingColor }]}>Thinking...</Text>
					</View>
				)}
				</ScrollView>

			{showScrollButton && (
				<Animated.View
					style={[
						styles.scrollButtonWrap,
						{ bottom: bottomOffset, transform: [{ translateY: bounceAnim }] },
					]}
				>
					<Pressable style={styles.scrollButton} onPress={onScrollToBottom}>
						<Text style={styles.scrollButtonText}>↓</Text>
					</Pressable>
				</Animated.View>
			)}
		</>
	);
}

const styles = StyleSheet.create({
	scroll: {
		flex: 1,
	},
	content: {
		padding: 16,
		gap: 4,
	},
	empty: {
		textAlign: 'center',
		marginTop: 40,
		fontSize: 15,
	},
	loadingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		paddingVertical: 4,
		alignSelf: 'flex-start',
	},
	loadingText: {
		fontSize: 14,
	},
	errorText: {
		color: '#ff3b30',
		fontSize: 13,
		paddingVertical: 4,
	},
	scrollButtonWrap: {
		position: 'absolute',
		left: 0,
		right: 0,
		alignItems: 'center',
	},
	scrollButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: '#007AFF',
		justifyContent: 'center',
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 5,
	},
	scrollButtonText: {
		color: '#fff',
		fontSize: 20,
		fontWeight: '700',
		lineHeight: 24,
	},
	errorBanner: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		backgroundColor: '#3a0000',
		paddingHorizontal: 14,
		paddingVertical: 10,
		gap: 8,
	},
	errorBannerText: {
		flex: 1,
		color: '#ff6b6b',
		fontSize: 13,
		lineHeight: 18,
	},
	errorDismiss: {
		paddingTop: 1,
	},
	errorDismissText: {
		color: '#ff6b6b',
		fontSize: 15,
		fontWeight: '700',
	},
});
