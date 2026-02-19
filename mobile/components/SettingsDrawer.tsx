import {
	Modal,
	View,
	Text,
	Pressable,
	ScrollView,
	StyleSheet,
	useColorScheme,
	Animated,
	useWindowDimensions,
	TextInput,
} from 'react-native';
import { useRef, useEffect, useState } from 'react';
import type { Project, Session } from '../types';

interface Props {
	visible: boolean;
	onClose: () => void;
	sessions: Session[];
	currentSessionId: string | null;
	selectedModel: string;
	connected: boolean;
	onSelectSession: (id: string) => void;
	onNewSession: () => void;
	onSelectModel: (model: string) => void;
	// Project management
	baseDir: string | null;
	projects: Project[];
	currentProjectId: string | null;
	onSelectProject: (id: string) => void;
	onSaveBaseDir: (value: string) => Promise<void>;
}

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
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const handleSave = async () => {
		if (!value.trim()) return;
		setSaving(true);
		setError(null);
		try {
			await onSave(value.trim());
			setValue('');
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to save');
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
			{error ? <Text style={inputStyles.error}>{error}</Text> : null}
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

export function SettingsDrawer({
	visible,
	onClose,
	sessions,
	currentSessionId,
	selectedModel,
	connected,
	onSelectSession,
	onNewSession,
	onSelectModel,
	baseDir,
	projects,
	currentProjectId,
	onSelectProject,
	onSaveBaseDir,
}: Props) {
	const colorScheme = useColorScheme();
	const isDark = colorScheme === 'dark';
	const { width } = useWindowDimensions();
	const drawerWidth = Math.min(width * 0.8, 320);

	const slideAnim = useRef(new Animated.Value(-drawerWidth)).current;
	const [editingBaseDir, setEditingBaseDir] = useState(false);

	useEffect(() => {
		Animated.timing(slideAnim, {
			toValue: visible ? 0 : -drawerWidth,
			duration: 250,
			useNativeDriver: true,
		}).start();
	}, [visible, drawerWidth, slideAnim]);

	const bg = isDark ? '#1c1c1e' : '#fff';
	const text = isDark ? '#fff' : '#000';
	const subtext = isDark ? '#ebebf5' : '#666';
	const border = isDark ? '#3a3a3c' : '#e0e0e0';
	const selectedBg = isDark ? '#2c2c2e' : '#f0f0f0';

	const handleSaveBaseDir = async (value: string) => {
		await onSaveBaseDir(value);
		setEditingBaseDir(false);
	};

	return (
		<Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
			<View style={styles.overlay}>
				<Pressable style={styles.backdrop} onPress={onClose} />
				<Animated.View
					style={[
						styles.drawer,
						{ width: drawerWidth, backgroundColor: bg, transform: [{ translateX: slideAnim }] },
					]}
				>
					<View style={[styles.drawerHeader, { borderBottomColor: border }]}>
						<Text style={[styles.drawerTitle, { color: text }]}>Settings</Text>
						<View style={styles.connectionStatus}>
							<View
								style={[styles.statusDot, { backgroundColor: connected ? '#34c759' : '#ff3b30' }]}
							/>
							<Text style={[styles.statusLabel, { color: subtext }]}>
								{connected ? 'Connected' : 'Disconnected'}
							</Text>
						</View>
					</View>

					<ScrollView style={styles.drawerContent} showsVerticalScrollIndicator={false}>
						{/* Base Directory */}
						<Text style={[styles.sectionLabel, { color: subtext }]}>Base Directory</Text>
						{baseDir && !editingBaseDir ? (
							<View style={[styles.baseDirRow, { borderColor: border }]}>
								<Text style={[styles.baseDirText, { color: text }]}>~/{baseDir}</Text>
								<Pressable onPress={() => setEditingBaseDir(true)}>
									<Text style={styles.editLink}>Edit</Text>
								</Pressable>
							</View>
						) : (
							<BaseDirInput
								onSave={handleSaveBaseDir}
								isDark={isDark}
								text={text}
								border={border}
								subtext={subtext}
							/>
						)}

						{/* Projects */}
						{baseDir ? (
							<>
								<Text style={[styles.sectionLabel, { color: subtext, marginTop: 16 }]}>
									Projects
								</Text>
								{projects.length === 0 ? (
									<Text style={[styles.emptyText, { color: subtext }]}>No repos found</Text>
								) : (
									projects.map((project) => (
										<Pressable
											key={project.id}
											style={[
												styles.projectRow,
												{ borderColor: border },
												currentProjectId === project.id && { backgroundColor: selectedBg },
											]}
											onPress={() => {
												onSelectProject(project.id);
												onClose();
											}}
										>
											<Text style={[styles.projectName, { color: text }]} numberOfLines={1}>
												{project.name}
											</Text>
											{currentProjectId === project.id && (
												<Text style={styles.checkmark}>✓</Text>
											)}
										</Pressable>
									))
								)}
							</>
						) : null}

						{/* Model selector */}
						<Text style={[styles.sectionLabel, { color: subtext, marginTop: 16 }]}>Model</Text>
						{['haiku', 'sonnet'].map((model) => (
							<Pressable
								key={model}
								style={[
									styles.modelRow,
									{ borderColor: border },
									selectedModel === model && { backgroundColor: selectedBg },
								]}
								onPress={() => onSelectModel(model)}
							>
								<Text style={[styles.modelName, { color: text }]}>
									{model.charAt(0).toUpperCase() + model.slice(1)}
								</Text>
								{selectedModel === model && <Text style={styles.checkmark}>✓</Text>}
							</Pressable>
						))}

						{/* New session button — only if project selected */}
						{currentProjectId ? (
							<Pressable
								style={styles.newSessionButton}
								onPress={() => {
									onNewSession();
									onClose();
								}}
							>
								<Text style={styles.newSessionText}>+ New Session</Text>
							</Pressable>
						) : null}

						{/* Sessions list */}
						{sessions.length > 0 ? (
							<>
								<Text style={[styles.sectionLabel, { color: subtext, marginTop: 16 }]}>
									Sessions
								</Text>
								{sessions.map((session) => (
									<Pressable
										key={session.id}
										style={[
											styles.sessionRow,
											{ borderColor: border },
											currentSessionId === session.id && { backgroundColor: selectedBg },
										]}
										onPress={() => {
											onSelectSession(session.id);
											onClose();
										}}
									>
										<Text style={[styles.sessionId, { color: text }]} numberOfLines={1}>
											{session.id.slice(0, 8)}…
										</Text>
										<Text style={[styles.sessionModel, { color: subtext }]}>{session.model}</Text>
									</Pressable>
								))}
							</>
						) : null}
					</ScrollView>
				</Animated.View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		flexDirection: 'row',
	},
	backdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.4)',
	},
	drawer: {
		position: 'absolute',
		top: 0,
		bottom: 0,
		left: 0,
		shadowColor: '#000',
		shadowOffset: { width: 2, height: 0 },
		shadowOpacity: 0.2,
		shadowRadius: 8,
		elevation: 8,
	},
	drawerHeader: {
		paddingTop: 60,
		paddingBottom: 16,
		paddingHorizontal: 20,
		borderBottomWidth: 1,
	},
	drawerTitle: {
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
	drawerContent: {
		flex: 1,
		padding: 16,
	},
	sectionLabel: {
		fontSize: 12,
		fontWeight: '600',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
		marginBottom: 8,
	},
	baseDirRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: 12,
		borderRadius: 10,
		borderWidth: 1,
		marginBottom: 8,
	},
	baseDirText: {
		fontSize: 14,
		flex: 1,
	},
	editLink: {
		color: '#007AFF',
		fontSize: 14,
	},
	projectRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: 12,
		borderRadius: 10,
		borderWidth: 1,
		marginBottom: 8,
	},
	projectName: {
		fontSize: 14,
		fontWeight: '500',
		flex: 1,
	},
	modelRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: 12,
		borderRadius: 10,
		borderWidth: 1,
		marginBottom: 8,
	},
	modelName: {
		fontSize: 15,
		fontWeight: '500',
	},
	checkmark: {
		color: '#007AFF',
		fontSize: 16,
		fontWeight: '700',
	},
	newSessionButton: {
		backgroundColor: '#007AFF',
		borderRadius: 10,
		padding: 12,
		alignItems: 'center',
		marginTop: 8,
	},
	newSessionText: {
		color: '#fff',
		fontSize: 15,
		fontWeight: '600',
	},
	sessionRow: {
		padding: 12,
		borderRadius: 10,
		borderWidth: 1,
		marginBottom: 8,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	sessionId: {
		fontSize: 14,
		fontFamily: 'monospace',
		flex: 1,
	},
	sessionModel: {
		fontSize: 12,
		marginLeft: 8,
	},
	emptyText: {
		fontSize: 14,
		fontStyle: 'italic',
		paddingVertical: 8,
	},
});
