import { useEffect, useState } from 'react';
import {
	Modal,
	View,
	Text,
	TextInput,
	Pressable,
	StyleSheet,
	useColorScheme,
	KeyboardAvoidingView,
	Platform,
	Keyboard,
} from 'react-native';
import type { Session } from '../types';

interface Props {
	session: Session | null;
	onClose: () => void;
	onRename: (id: string, name: string) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
}

export function SessionActionModal({ session, onClose, onRename, onDelete }: Props) {
	const isDark = useColorScheme() === 'dark';
	const [nameInput, setNameInput] = useState('');
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);

	useEffect(() => {
		if (session) {
			setNameInput(session.name ?? '');
		}
	}, [session]);

	const originalName = session?.name ?? '';
	const trimmed = nameInput.trim();
	const saveDisabled = trimmed === originalName || saving || deleting;

	const handleSave = async () => {
		if (!session || saveDisabled) return;
		setSaving(true);
		try {
			await onRename(session.id, trimmed);
			onClose();
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!session || deleting) return;
		setDeleting(true);
		try {
			await onDelete(session.id);
			onClose();
		} finally {
			setDeleting(false);
		}
	};

	const cardBg = isDark ? '#2c2c2e' : '#fff';
	const textColor = isDark ? '#fff' : '#000';
	const subtextColor = isDark ? '#ebebf599' : '#888';
	const inputBg = isDark ? '#3a3a3c' : '#f2f2f7';
	const borderColor = isDark ? '#3a3a3c' : '#e0e0e0';
	const cancelBg = isDark ? '#3a3a3c' : '#f2f2f7';
	const saveBg = isDark ? '#0a84ff' : '#007AFF';
	const saveDisabledBg = isDark ? '#3a3a3c' : '#c7c7cc';

	return (
		<Modal
			visible={session !== null}
			transparent
			animationType="fade"
			onRequestClose={onClose}
		>
			<KeyboardAvoidingView
				style={styles.kav}
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
			>
				<Pressable style={styles.overlay} onPress={Keyboard.dismiss}>
					<Pressable style={[styles.card, { backgroundColor: cardBg }]} onPress={() => {}}>
						<Text style={[styles.title, { color: textColor }]}>Rename Session</Text>

						<TextInput
							style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
							placeholder="Session name"
							placeholderTextColor={subtextColor}
							value={nameInput}
							onChangeText={setNameInput}
							autoFocus
							returnKeyType="done"
							onSubmitEditing={handleSave}
						/>

						<View style={styles.buttonRow}>
							<Pressable
								style={[styles.button, styles.cancelButton, { backgroundColor: cancelBg }]}
								onPress={onClose}
							>
								<Text style={[styles.buttonText, { color: textColor }]}>Cancel</Text>
							</Pressable>

							<Pressable
								style={[
									styles.button,
									styles.saveButton,
									{ backgroundColor: saveDisabled ? saveDisabledBg : saveBg },
								]}
								onPress={handleSave}
								disabled={saveDisabled}
							>
								<Text style={[styles.buttonText, { color: '#fff' }]}>
									{saving ? 'Saving...' : 'Save'}
								</Text>
							</Pressable>
						</View>

						<View style={[styles.divider, { backgroundColor: borderColor }]} />

						<Pressable
							style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}
							onPress={handleDelete}
							disabled={deleting}
						>
							<Text style={styles.deleteButtonText}>
								{deleting ? 'Deleting...' : 'Delete Session'}
							</Text>
						</Pressable>
					</Pressable>
				</Pressable>
			</KeyboardAvoidingView>
		</Modal>
	);
}

const styles = StyleSheet.create({
	kav: {
		flex: 1,
	},
	overlay: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.5)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	card: {
		width: 320,
		borderRadius: 16,
		padding: 24,
	},
	title: {
		fontSize: 17,
		fontWeight: '700',
		marginBottom: 16,
	},
	input: {
		borderRadius: 10,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: 12,
		paddingVertical: 10,
		fontSize: 15,
		marginBottom: 16,
	},
	buttonRow: {
		flexDirection: 'row',
		gap: 10,
		marginBottom: 16,
	},
	button: {
		flex: 1,
		borderRadius: 10,
		paddingVertical: 11,
		alignItems: 'center',
	},
	cancelButton: {},
	saveButton: {},
	buttonText: {
		fontSize: 15,
		fontWeight: '600',
	},
	divider: {
		height: StyleSheet.hairlineWidth,
		marginBottom: 16,
	},
	deleteButton: {
		backgroundColor: '#ff3b30',
		borderRadius: 10,
		paddingVertical: 11,
		alignItems: 'center',
	},
	deleteButtonDisabled: {
		opacity: 0.5,
	},
	deleteButtonText: {
		fontSize: 15,
		fontWeight: '600',
		color: '#fff',
	},
});
