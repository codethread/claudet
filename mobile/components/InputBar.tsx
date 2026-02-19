import { StyleSheet, View, TextInput, Pressable, Text, useColorScheme } from 'react-native';

interface Props {
	input: string;
	onChangeInput: (text: string) => void;
	onSend: () => void;
	editable: boolean;
	canSend: boolean;
	bottomInset: number;
}

export function InputBar({ input, onChangeInput, onSend, editable, canSend, bottomInset }: Props) {
	const isDark = useColorScheme() === 'dark';
	const bg = isDark ? '#1c1c1e' : '#fff';
	const inputBg = isDark ? '#2c2c2e' : '#f0f0f0';
	const inputText = isDark ? '#fff' : '#000';
	const border = isDark ? '#3a3a3c' : '#e0e0e0';

	return (
		<View
			style={[
				styles.row,
				{ backgroundColor: bg, borderTopColor: border, paddingBottom: 12 + bottomInset },
			]}
		>
			<TextInput
				style={[styles.input, { backgroundColor: inputBg, color: inputText }]}
				value={input}
				onChangeText={onChangeInput}
				placeholder="Type a message..."
				placeholderTextColor={isDark ? '#636366' : '#999'}
				multiline
				editable={editable}
			/>
			<Pressable
				style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
				onPress={onSend}
				disabled={!canSend}
			>
				<Text style={styles.sendButtonText}>→</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		padding: 12,
		gap: 8,
		borderTopWidth: 1,
	},
	input: {
		flex: 1,
		minHeight: 40,
		maxHeight: 120,
		borderRadius: 20,
		paddingHorizontal: 16,
		paddingVertical: 10,
		fontSize: 15,
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
