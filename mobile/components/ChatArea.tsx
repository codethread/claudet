import { useRef, useEffect } from 'react';
import {
	Animated,
	StyleSheet,
	View,
	ScrollView,
	type NativeSyntheticEvent,
	type NativeScrollEvent,
} from 'react-native';
import { ActivityIndicator, Banner, Text, IconButton, useTheme } from 'react-native-paper';
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
	const theme = useTheme();
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
			<Banner
				visible={!!error}
				actions={[{ label: 'Dismiss', onPress: onDismissError }]}
				icon="alert"
			>
				{error ? friendlyError(error) : ''}
			</Banner>

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
					<Text
						variant="bodyMedium"
						style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}
					>
						{loadingMessages ? 'Loading messages…' : 'Send a message to start chatting'}
					</Text>
				)}
				{messages.map((msg, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: messages are append-only, index is stable
					<ChatMessage key={i} message={msg} />
				))}
				{loading && (
					<View style={styles.loadingRow}>
						<ActivityIndicator size="small" />
						<Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
							Thinking...
						</Text>
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
					<IconButton
						icon="arrow-down"
						mode="contained"
						onPress={onScrollToBottom}
						size={20}
						style={styles.scrollButton}
					/>
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
	},
	loadingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		paddingVertical: 4,
		alignSelf: 'flex-start',
	},
	scrollButtonWrap: {
		position: 'absolute',
		left: 0,
		right: 0,
		alignItems: 'center',
	},
	scrollButton: {
		elevation: 5,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
	},
});
