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
} from 'react-native';
import { useRef, useEffect } from 'react';
import type { Session } from '../types';

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
}

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
}: Props) {
	const colorScheme = useColorScheme();
	const isDark = colorScheme === 'dark';
	const { width } = useWindowDimensions();
	const drawerWidth = Math.min(width * 0.8, 320);

	const slideAnim = useRef(new Animated.Value(-drawerWidth)).current;

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
						{/* Model selector */}
						<Text style={[styles.sectionLabel, { color: subtext }]}>Model</Text>
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

						{/* New session button */}
						<Pressable
							style={styles.newSessionButton}
							onPress={() => {
								onNewSession();
								onClose();
							}}
						>
							<Text style={styles.newSessionText}>+ New Session</Text>
						</Pressable>

						{/* Sessions list */}
						<Text style={[styles.sectionLabel, { color: subtext, marginTop: 16 }]}>Sessions</Text>
						{sessions.length === 0 ? (
							<Text style={[styles.emptyText, { color: subtext }]}>No sessions yet</Text>
						) : (
							sessions.map((session) => (
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
							))
						)}
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
