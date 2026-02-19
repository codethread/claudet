import { StyleSheet, Text, View, Pressable, useColorScheme } from 'react-native';

interface Props {
	greeting: string;
	onOpenSettings: () => void;
	onNewSession: () => void;
	dangerousMode?: boolean;
}

export function Header({ greeting, onOpenSettings, onNewSession, dangerousMode }: Props) {
	const isDark = useColorScheme() === 'dark';
	const bg = isDark ? '#1c1c1e' : '#fff';
	const border = isDark ? '#3a3a3c' : '#e0e0e0';
	const text = isDark ? '#fff' : '#000';

	return (
		<View style={{ backgroundColor: bg, borderBottomColor: border, borderBottomWidth: 1 }}>
			<View style={styles.header}>
				<Pressable style={styles.button} onPress={onOpenSettings} hitSlop={8}>
					<Text style={[styles.icon, { color: text }]}>☰</Text>
				</Pressable>
				<Text style={[styles.title, { color: text }]} numberOfLines={1}>
					{greeting}
				</Text>
				<Pressable style={styles.button} onPress={onNewSession} hitSlop={8}>
					<Text style={[styles.icon, { color: text }]}>＋</Text>
				</Pressable>
			</View>
			{dangerousMode ? (
				<View style={styles.dangerBanner}>
					<Text style={styles.dangerText}>⚠ Permissions bypassed</Text>
				</View>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	header: {
		paddingTop: 56,
		paddingBottom: 12,
		paddingHorizontal: 16,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	dangerBanner: {
		backgroundColor: '#ff9500',
		paddingVertical: 4,
		paddingHorizontal: 16,
		alignItems: 'center',
	},
	dangerText: {
		color: '#fff',
		fontSize: 12,
		fontWeight: '600',
	},
	button: {
		padding: 4,
		minWidth: 36,
		alignItems: 'center',
	},
	icon: {
		fontSize: 22,
		fontWeight: '500',
	},
	title: {
		fontSize: 17,
		fontWeight: '600',
		flex: 1,
		textAlign: 'center',
	},
});
