import { View, StyleSheet } from 'react-native';
import { TextInput, IconButton, useTheme } from 'react-native-paper';

interface Props {
	input: string;
	onChangeInput: (text: string) => void;
	onSend: () => void;
	editable: boolean;
	canSend: boolean;
	bottomInset: number;
}

export function InputBar({ input, onChangeInput, onSend, editable, canSend, bottomInset }: Props) {
	const theme = useTheme();
	return (
		<View
			style={[
				styles.row,
				{
					backgroundColor: theme.colors.surface,
					borderTopColor: theme.colors.outline,
					paddingBottom: 12 + bottomInset,
				},
			]}
		>
			<TextInput
				style={styles.input}
				mode="outlined"
				value={input}
				onChangeText={onChangeInput}
				placeholder="Type a message..."
				multiline
				editable={editable}
				dense
				outlineStyle={{ borderRadius: 20 }}
			/>
			<IconButton
				icon="send"
				mode="contained"
				onPress={onSend}
				disabled={!canSend}
				size={22}
				style={styles.sendButton}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		paddingTop: 8,
		paddingHorizontal: 12,
		gap: 4,
		borderTopWidth: StyleSheet.hairlineWidth,
	},
	input: {
		flex: 1,
		maxHeight: 120,
	},
	sendButton: {
		marginBottom: 2,
	},
});
