import { ScrollView, View, StyleSheet } from 'react-native';
import { Chip, useTheme } from 'react-native-paper';
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
	const theme = useTheme();

	return (
		<View style={[styles.container, { backgroundColor: theme.colors.surfaceVariant, borderBottomColor: theme.colors.outline }]}>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.strip}
			>
				{sessions.map((session) => {
					const active = session.id === currentSessionId;
					return (
						<Chip
							key={session.id}
							selected={active}
							onPress={() => onSelectSession(session.id)}
							onLongPress={() => onLongPressSession(session)}
							compact
							style={styles.chip}
						>
							{sessionLabel(session)}
						</Chip>
					);
				})}

				<Chip
					icon="plus"
					onPress={onNewSession}
					compact
					style={styles.chip}
				>
					New
				</Chip>
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
		maxWidth: 160,
	},
});
