import { useColorScheme, View, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import type { Message } from '../types';

interface Props {
	message: Message;
}

export function ChatMessage({ message }: Props) {
	const colorScheme = useColorScheme();
	const isDark = colorScheme === 'dark';

	const isUser = message.role === 'user';

	const markdownStyles = isUser
		? userMarkdownStyles
		: isDark
			? assistantMarkdownStylesDark
			: assistantMarkdownStylesLight;

	return (
		<View style={[styles.row, isUser ? styles.rowEnd : styles.rowStart]}>
			<View
				style={[
					styles.bubble,
					isUser
						? styles.userBubble
						: isDark
							? styles.assistantBubbleDark
							: styles.assistantBubbleLight,
				]}
			>
				<Markdown style={markdownStyles}>{message.content}</Markdown>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		marginVertical: 4,
	},
	rowEnd: {
		justifyContent: 'flex-end',
	},
	rowStart: {
		justifyContent: 'flex-start',
	},
	bubble: {
		maxWidth: 600,
		width: '95%',
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: 18,
		flexShrink: 1,
	},
	userBubble: {
		backgroundColor: '#007AFF',
	},
	assistantBubbleLight: {
		backgroundColor: '#fff',
		borderWidth: 1,
		borderColor: '#e0e0e0',
	},
	assistantBubbleDark: {
		backgroundColor: '#2c2c2e',
		borderWidth: 1,
		borderColor: '#3a3a3c',
	},
});

const userMarkdownStyles = StyleSheet.create({
	body: { color: '#fff', fontSize: 15, lineHeight: 22 },
	code_inline: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, paddingHorizontal: 4 },
	fence: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 10 },
	code_block: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 10 },
	link: { color: '#cce0ff' },
});

const assistantMarkdownStylesLight = StyleSheet.create({
	body: { color: '#000', fontSize: 15, lineHeight: 22 },
	code_inline: { backgroundColor: '#f0f0f0', borderRadius: 4, paddingHorizontal: 4 },
	fence: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 10 },
	code_block: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 10 },
	link: { color: '#007AFF' },
});

const assistantMarkdownStylesDark = StyleSheet.create({
	body: { color: '#fff', fontSize: 15, lineHeight: 22 },
	code_inline: { backgroundColor: '#3a3a3c', borderRadius: 4, paddingHorizontal: 4 },
	fence: { backgroundColor: '#1c1c1e', borderRadius: 8, padding: 10 },
	code_block: { backgroundColor: '#1c1c1e', borderRadius: 8, padding: 10 },
	link: { color: '#64b5f6' },
});
