import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
	List,
	TextInput,
	Button,
	Switch,
	Divider,
	Text,
	Appbar,
	useTheme,
} from 'react-native-paper';
import { useAppContext } from '../AppContext';

function BaseDirInput({ onSave }: { onSave: (value: string) => Promise<void> }) {
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
		<View style={baseDirStyles.container}>
			<View style={baseDirStyles.row}>
				<Text variant="bodyMedium" style={baseDirStyles.prefix}>~/</Text>
				<TextInput
					style={baseDirStyles.input}
					mode="outlined"
					label="e.g. dev"
					value={value}
					onChangeText={setValue}
					autoCapitalize="none"
					autoCorrect={false}
					dense
				/>
				<Button
					mode="contained"
					onPress={handleSave}
					disabled={saving || !value.trim()}
					loading={saving}
					style={baseDirStyles.saveButton}
				>
					Save
				</Button>
			</View>
			{saveError ? (
				<Text variant="labelSmall" style={baseDirStyles.error}>{saveError}</Text>
			) : null}
		</View>
	);
}

const baseDirStyles = StyleSheet.create({
	container: { paddingHorizontal: 16, paddingVertical: 8 },
	row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
	prefix: { marginBottom: 6 },
	input: { flex: 1 },
	saveButton: { borderRadius: 8 },
	error: { color: '#ff3b30', marginTop: 4 },
});

export function SettingsScreen() {
	const theme = useTheme();
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

	const [editingBaseDir, setEditingBaseDir] = useState(false);

	const currentSession = sessions.find((s) => s.id === currentSessionId) ?? null;
	const permissionMode = currentSession?.permissionMode ?? 'allowEdits';

	const handleSaveBaseDirAndReset = async (value: string) => {
		await handleSaveBaseDir(value);
		setEditingBaseDir(false);
	};

	return (
		<View style={[styles.container, { backgroundColor: theme.colors.background }]}>
			<Appbar.Header statusBarHeight={insets.top} elevated>
				<Appbar.Content title="Settings" />
				<View style={styles.connectionStatus}>
					<View style={[styles.statusDot, { backgroundColor: connected ? '#34c759' : '#ff3b30' }]} />
					<Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginRight: 16 }}>
						{connected ? 'Connected' : 'Disconnected'}
					</Text>
				</View>
			</Appbar.Header>

			<ScrollView
				style={styles.scroll}
				contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
				showsVerticalScrollIndicator={false}
			>
				{/* Base Directory */}
				<List.Section>
					<List.Subheader>Base Directory</List.Subheader>
					{baseDir && !editingBaseDir ? (
						<List.Item
							title={`~/${baseDir}`}
							right={() => (
								<Button
									mode="text"
									onPress={() => setEditingBaseDir(true)}
									compact
								>
									Edit
								</Button>
							)}
						/>
					) : (
						<BaseDirInput onSave={handleSaveBaseDirAndReset} />
					)}
				</List.Section>

				<Divider />

				{/* Projects */}
				{baseDir ? (
					<List.Section>
						<List.Subheader>Projects</List.Subheader>
						{projects.length === 0 ? (
							<List.Item title="No repos found" titleStyle={{ color: theme.colors.onSurfaceVariant, fontStyle: 'italic' }} />
						) : (
							projects.map((project) => (
								<List.Item
									key={project.id}
									title={project.name}
									description={project.path}
									onPress={() => handleSelectProject(project.id)}
									right={() =>
										currentProjectId === project.id ? (
											<List.Icon icon="check" color={theme.colors.primary} />
										) : null
									}
									style={currentProjectId === project.id ? { backgroundColor: theme.colors.primaryContainer } : undefined}
								/>
							))
						)}
					</List.Section>
				) : null}

				{baseDir ? <Divider /> : null}

				{/* Model selector */}
				<List.Section>
					<List.Subheader>Model</List.Subheader>
					{['haiku', 'sonnet'].map((model) => (
						<List.Item
							key={model}
							title={model.charAt(0).toUpperCase() + model.slice(1)}
							onPress={() => setSelectedModel(model)}
							right={() =>
								selectedModel === model ? (
									<List.Icon icon="check" color={theme.colors.primary} />
								) : null
							}
							style={selectedModel === model ? { backgroundColor: theme.colors.primaryContainer } : undefined}
						/>
					))}
				</List.Section>

				{/* Permission Mode */}
				{currentSessionId ? (
					<>
						<Divider />
						<List.Section>
							<List.Subheader>Permissions</List.Subheader>
							<List.Item
								title="Bypass Permissions"
								description="--dangerously-skip-permissions"
								right={() => (
									<Switch
										value={permissionMode === 'dangerouslySkipPermissions'}
										onValueChange={(val) =>
											handleSetSessionPermissionMode(val ? 'dangerouslySkipPermissions' : 'allowEdits')
										}
										color="#ff9500"
									/>
								)}
							/>
						</List.Section>
					</>
				) : null}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	scroll: { flex: 1 },
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
});
