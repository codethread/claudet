import { useRef, useEffect } from 'react';
import {
	Animated,
	StyleSheet,
	Text,
	View,
	ScrollView,
	ActivityIndicator,
	Pressable,
	type NativeSyntheticEvent,
	type NativeScrollEvent,
} from 'react-native';
import { ChatMessage } from './ChatMessage';
import type { Message } from '../types';

interface Props {
	messages: Message[];
	loading: boolean;
	loadingMessages: boolean;
	error: string | null;
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
	scrollRef,
	showScrollButton,
	onScrollToBottom,
	onScroll,
	bottomOffset,
}: Props) {
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
					<Text style={styles.empty}>
						{loadingMessages ? 'Loading messages…' : 'Send a message to start chatting'}
					</Text>
				)}
				{messages.map((msg, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: messages are append-only, index is stable
					<ChatMessage key={i} message={msg} />
				))}
				{loading && (
					<View style={styles.loadingRow}>
						<ActivityIndicator size="small" color="#666" />
						<Text style={styles.loadingText}>Thinking...</Text>
					</View>
				)}
				{error && <Text style={styles.errorText}>{error}</Text>}
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
		color: '#999',
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
		color: '#666',
		fontSize: 14,
	},
	errorText: {
		color: '#cc0000',
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
});
