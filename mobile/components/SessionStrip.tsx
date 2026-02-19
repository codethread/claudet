import { ScrollView, View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import type { Session } from '../types';

function sessionLabel(session: Session): string {
	if (session.name) return session.name;
	const d = new Date(session.createdAt);
	const now = new Date();
	const isToday = d.toDateString() === now.toDateString();
	if (isToday) {
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
	return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

interface Props {
	sessions: Session[];
	currentSessionId: string | null;
	onSelectSession: (id: string) => void;
	onNewSession: () => void;
	onLongPressSession: (session: Session) => void;
}

export function SessionStrip({
	sessions,
	currentSessionId,
	onSelectSession,
	onNewSession,
	onLongPressSession,
}: Props) {
	const isDark = useColorScheme() === 'dark';

	const bg = isDark ? '#1c1c1e' : '#f2f2f7';
	const chipBg = isDark ? '#2c2c2e' : '#fff';
	const activeBg = isDark ? '#0a84ff' : '#007AFF';
	const text = isDark ? '#fff' : '#000';
	const subtext = isDark ? '#ebebf599' : '#888';
	const border = isDark ? '#3a3a3c' : '#e0e0e0';

	return (
		<View style={[styles.container, { backgroundColor: bg, borderBottomColor: border }]}>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.strip}
			>
				{sessions.map((session) => {
					const active = session.id === currentSessionId;
					return (
						<Pressable
							key={session.id}
							style={[
								styles.chip,
								{ backgroundColor: active ? activeBg : chipBg, borderColor: border },
							]}
							onPress={() => onSelectSession(session.id)}
							onLongPress={() => onLongPressSession(session)}
						>
							<Text style={[styles.chipLabel, { color: active ? '#fff' : text }]} numberOfLines={1}>
								{sessionLabel(session)}
							</Text>
							<Text style={[styles.chipModel, { color: active ? '#ffffffaa' : subtext }]}>
								{session.model}
							</Text>
						</Pressable>
					);
				})}

				<Pressable
					style={[styles.chip, styles.newChip, { backgroundColor: chipBg, borderColor: border }]}
					onPress={onNewSession}
				>
					<Text style={[styles.newChipText, { color: text }]}>＋</Text>
				</Pressable>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	strip: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		paddingVertical: 8,
		gap: 8,
	},
	chip: {
		borderRadius: 20,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: 14,
		paddingVertical: 6,
		alignItems: 'center',
		maxWidth: 120,
	},
	chipLabel: {
		fontSize: 13,
		fontWeight: '500',
	},
	chipModel: {
		fontSize: 10,
		marginTop: 1,
	},
	newChip: {
		paddingHorizontal: 14,
		paddingVertical: 6,
	},
	newChipText: {
		fontSize: 18,
		lineHeight: 22,
	},
});
