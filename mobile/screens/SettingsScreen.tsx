import { useState } from 'react';
import {
	View,
	Text,
	ScrollView,
	Pressable,
	TextInput,
	Switch,
	StyleSheet,
	useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '../AppContext';

function BaseDirInput({
	onSave,
	isDark,
	text,
	border,
	subtext,
}: {
	onSave: (value: string) => Promise<void>;
	isDark: boolean;
	text: string;
	border: string;
	subtext: string;
}) {
	const [value, setValue] = useState('');
	const [saveError, setSaveError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const handleSave = async () => {
		if (!value.trim()) return;
		setSaving(true);
		setSaveError(null);
		try {
			await onSave(value.trim());
			setValue('');
		} catch (e) {
			setSaveError(e instanceof Error ? e.message : 'Failed to save');
		} finally {
			setSaving(false);
		}
	};

	return (
		<View style={inputStyles.container}>
			<View style={inputStyles.row}>
				<Text style={[inputStyles.prefix, { color: subtext }]}>~/</Text>
				<TextInput
					style={[
						inputStyles.input,
						{ color: text, borderColor: border, backgroundColor: isDark ? '#2c2c2e' : '#f5f5f5' },
					]}
					placeholder="e.g. dev"
					placeholderTextColor={subtext}
					value={value}
					onChangeText={setValue}
					autoCapitalize="none"
					autoCorrect={false}
				/>
				<Pressable
					style={[inputStyles.saveButton, saving && inputStyles.saveButtonDisabled]}
					onPress={handleSave}
					disabled={saving}
				>
					<Text style={inputStyles.saveButtonText}>{saving ? '…' : 'Save'}</Text>
				</Pressable>
			</View>
			{saveError ? <Text style={inputStyles.error}>{saveError}</Text> : null}
		</View>
	);
}

const inputStyles = StyleSheet.create({
	container: { marginBottom: 8 },
	row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
	prefix: { fontSize: 14 },
	input: {
		flex: 1,
		borderWidth: 1,
		borderRadius: 8,
		paddingHorizontal: 10,
		paddingVertical: 8,
		fontSize: 14,
	},
	saveButton: {
		backgroundColor: '#007AFF',
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
	saveButtonDisabled: { opacity: 0.5 },
	saveButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
	error: { color: '#ff3b30', fontSize: 12, marginTop: 4 },
});

export function SettingsScreen() {
	const isDark = useColorScheme() === 'dark';
	const insets = useSafeAreaInsets();

	const {
		connected,
		baseDir,
		projects,
		currentProjectId,
		selectedModel,
		currentSessionId,
		sessions,
		handleSelectProject,
		handleSaveBaseDir,
		handleSetSessionPermissionMode,
		setSelectedModel,
	} = useAppContext();

	const bg = isDark ? '#000' : '#f5f5f5';
	const cardBg = isDark ? '#1c1c1e' : '#fff';
	const text = isDark ? '#fff' : '#000';
	const subtext = isDark ? '#ebebf5aa' : '#666';
	const border = isDark ? '#3a3a3c' : '#e0e0e0';
	const selectedBg = isDark ? '#2c2c2e' : '#f0f0f0';

	const [editingBaseDir, setEditingBaseDir] = useState(false);

	const currentSession = sessions.find((s) => s.id === currentSessionId) ?? null;
	const permissionMode = currentSession?.permissionMode ?? 'allowEdits';

	const handleSaveBaseDirAndReset = async (value: string) => {
		await handleSaveBaseDir(value);
		setEditingBaseDir(false);
	};

	return (
		<View style={[styles.container, { backgroundColor: bg }]}>
			<View style={[styles.titleBar, { backgroundColor: cardBg, borderBottomColor: border, paddingTop: insets.top + 16 }]}>
				<Text style={[styles.screenTitle, { color: text }]}>Settings</Text>
				<View style={styles.connectionStatus}>
					<View style={[styles.statusDot, { backgroundColor: connected ? '#34c759' : '#ff3b30' }]} />
					<Text style={[styles.statusLabel, { color: subtext }]}>
						{connected ? 'Connected' : 'Disconnected'}
					</Text>
				</View>
			</View>

			<ScrollView
				style={styles.scroll}
				contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
				showsVerticalScrollIndicator={false}
			>
				{/* Base Directory */}
				<Text style={[styles.sectionLabel, { color: subtext }]}>Base Directory</Text>
				<View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
					{baseDir && !editingBaseDir ? (
						<View style={styles.baseDirRow}>
							<Text style={[styles.baseDirText, { color: text }]}>~/{baseDir}</Text>
							<Pressable onPress={() => setEditingBaseDir(true)}>
								<Text style={styles.editLink}>Edit</Text>
							</Pressable>
						</View>
					) : (
						<BaseDirInput
							onSave={handleSaveBaseDirAndReset}
							isDark={isDark}
							text={text}
							border={border}
							subtext={subtext}
						/>
					)}
				</View>

				{/* Projects */}
				{baseDir ? (
					<>
						<Text style={[styles.sectionLabel, { color: subtext, marginTop: 24 }]}>Projects</Text>
						{projects.length === 0 ? (
							<Text style={[styles.emptyText, { color: subtext }]}>No repos found</Text>
						) : (
							projects.map((project) => (
								<Pressable
									key={project.id}
									style={[
										styles.rowCard,
										{ backgroundColor: cardBg, borderColor: border },
										currentProjectId === project.id && { backgroundColor: selectedBg },
									]}
									onPress={() => handleSelectProject(project.id)}
								>
									<View style={styles.rowContent}>
										<Text style={[styles.rowTitle, { color: text }]} numberOfLines={1}>
											{project.name}
										</Text>
										<Text style={[styles.rowSubtitle, { color: subtext }]} numberOfLines={1}>
											{project.path}
										</Text>
									</View>
									{currentProjectId === project.id && (
										<Text style={styles.checkmark}>✓</Text>
									)}
								</Pressable>
							))
						)}
					</>
				) : null}

				{/* Model selector */}
				<Text style={[styles.sectionLabel, { color: subtext, marginTop: 24 }]}>Model</Text>
				{['haiku', 'sonnet'].map((model) => (
					<Pressable
						key={model}
						style={[
							styles.rowCard,
							{ backgroundColor: cardBg, borderColor: border },
							selectedModel === model && { backgroundColor: selectedBg },
						]}
						onPress={() => setSelectedModel(model)}
					>
						<Text style={[styles.rowTitle, { color: text }]}>
							{model.charAt(0).toUpperCase() + model.slice(1)}
						</Text>
						{selectedModel === model && <Text style={styles.checkmark}>✓</Text>}
					</Pressable>
				))}

				{/* Permission Mode — per session */}
				{currentSessionId ? (
					<>
						<Text style={[styles.sectionLabel, { color: subtext, marginTop: 24 }]}>
							Permissions
						</Text>
						<View style={[styles.rowCard, { backgroundColor: cardBg, borderColor: border }]}>
							<View style={styles.toggleInfo}>
								<Text style={[styles.rowTitle, { color: text }]}>Bypass Permissions</Text>
								<Text style={[styles.rowSubtitle, { color: subtext }]}>
									--dangerously-skip-permissions
								</Text>
							</View>
							<Switch
								value={permissionMode === 'dangerouslySkipPermissions'}
								onValueChange={(val) =>
									handleSetSessionPermissionMode(val ? 'dangerouslySkipPermissions' : 'allowEdits')
								}
								trackColor={{ false: '#767577', true: '#ff9500' }}
								thumbColor="#fff"
							/>
						</View>
					</>
				) : null}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	titleBar: {
		paddingHorizontal: 20,
		paddingBottom: 16,
		borderBottomWidth: 1,
	},
	screenTitle: {
		fontSize: 22,
		fontWeight: '700',
		marginBottom: 8,
	},
	connectionStatus: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	statusDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	statusLabel: {
		fontSize: 13,
	},
	scroll: {
		flex: 1,
	},
	content: {
		padding: 16,
	},
	sectionLabel: {
		fontSize: 12,
		fontWeight: '600',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
		marginBottom: 8,
	},
	card: {
		borderRadius: 12,
		borderWidth: 1,
		padding: 12,
	},
	baseDirRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	baseDirText: {
		fontSize: 14,
		flex: 1,
	},
	editLink: {
		color: '#007AFF',
		fontSize: 14,
	},
	rowCard: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: 14,
		borderRadius: 12,
		borderWidth: 1,
		marginBottom: 8,
	},
	rowContent: {
		flex: 1,
		marginRight: 8,
	},
	rowTitle: {
		fontSize: 15,
		fontWeight: '500',
	},
	rowSubtitle: {
		fontSize: 12,
		fontFamily: 'monospace',
		marginTop: 2,
	},
	checkmark: {
		color: '#007AFF',
		fontSize: 16,
		fontWeight: '700',
	},
	toggleInfo: {
		flex: 1,
		marginRight: 8,
	},
	emptyText: {
		fontSize: 14,
		fontStyle: 'italic',
		paddingVertical: 8,
	},
});
