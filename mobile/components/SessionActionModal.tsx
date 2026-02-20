import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Dialog, Portal, TextInput, Button, Divider, useTheme } from 'react-native-paper';
import type { Session } from '../types';

interface Props {
	session: Session | null;
	onClose: () => void;
	onRename: (id: string, name: string) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
}

export function SessionActionModal({ session, onClose, onRename, onDelete }: Props) {
	const theme = useTheme();
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

	return (
		<Portal>
			<Dialog visible={session !== null} onDismiss={onClose}>
				<Dialog.Title>Rename Session</Dialog.Title>
				<Dialog.Content>
					<TextInput
						mode="outlined"
						label="Session name"
						value={nameInput}
						onChangeText={setNameInput}
						autoFocus
						returnKeyType="done"
						onSubmitEditing={handleSave}
					/>
				</Dialog.Content>
				<Dialog.Actions>
					<Button onPress={onClose} disabled={saving || deleting}>Cancel</Button>
					<Button
						mode="contained"
						onPress={handleSave}
						disabled={saveDisabled}
						loading={saving}
					>
						Save
					</Button>
				</Dialog.Actions>
				<Divider />
				<View style={styles.deleteSection}>
					<Button
						mode="contained"
						buttonColor={theme.colors.error}
						textColor={theme.colors.onError}
						onPress={handleDelete}
						disabled={deleting}
						loading={deleting}
						style={styles.deleteButton}
					>
						{deleting ? 'Deleting...' : 'Delete Session'}
					</Button>
				</View>
			</Dialog>
		</Portal>
	);
}

const styles = StyleSheet.create({
	deleteSection: {
		padding: 16,
		paddingTop: 12,
	},
	deleteButton: {
		borderRadius: 8,
	},
});
