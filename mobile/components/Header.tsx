import { StyleSheet, Text, View, Pressable, useColorScheme } from 'react-native';

interface Props {
	greeting: string;
	onOpenSettings: () => void;
	onNewSession: () => void;
}

export function Header({ greeting, onOpenSettings, onNewSession }: Props) {
	const isDark = useColorScheme() === 'dark';
	const bg = isDark ? '#1c1c1e' : '#fff';
	const border = isDark ? '#3a3a3c' : '#e0e0e0';
	const text = isDark ? '#fff' : '#000';

	return (
		<View style={[styles.header, { backgroundColor: bg, borderBottomColor: border }]}>
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
	);
}

const styles = StyleSheet.create({
	header: {
		paddingTop: 56,
		paddingBottom: 12,
		paddingHorizontal: 16,
		borderBottomWidth: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
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
