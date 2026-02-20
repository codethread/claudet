import { View, StyleSheet } from 'react-native';
import { Surface, useTheme } from 'react-native-paper';
import Markdown from 'react-native-markdown-display';
import type { Message } from '../types';

interface Props {
	message: Message;
}

export function ChatMessage({ message }: Props) {
	const theme = useTheme();
	const isUser = message.role === 'user';

	const userMarkdownStyles = {
		body: { color: '#fff', fontSize: 15, lineHeight: 22 },
		code_inline: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, paddingHorizontal: 4 },
		fence: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 10 },
		code_block: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 10 },
		link: { color: '#cce0ff' },
	};

	const assistantMarkdownStyles = {
		body: { color: theme.colors.onSurface, fontSize: 15, lineHeight: 22 },
		code_inline: { backgroundColor: theme.colors.surfaceVariant, borderRadius: 4, paddingHorizontal: 4 },
		fence: { backgroundColor: theme.dark ? '#1c1c1e' : '#f0f0f0', borderRadius: 8, padding: 10 },
		code_block: { backgroundColor: theme.dark ? '#1c1c1e' : '#f0f0f0', borderRadius: 8, padding: 10 },
		link: { color: theme.colors.primary },
	};

	return (
		<View style={[styles.row, isUser ? styles.rowEnd : styles.rowStart]}>
			{isUser ? (
				<View style={[styles.bubble, { backgroundColor: theme.colors.primary }]}>
					<Markdown style={userMarkdownStyles}>{message.content}</Markdown>
				</View>
			) : (
				<Surface style={styles.bubble} elevation={1}>
					<Markdown style={assistantMarkdownStyles}>{message.content}</Markdown>
				</Surface>
			)}
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
});
