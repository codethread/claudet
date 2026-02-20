import { Appbar } from 'react-native-paper';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
	greeting: string;
	onOpenSettings?: () => void;
	onNewSession: () => void;
	dangerousMode?: boolean;
}

export function Header({ greeting, onOpenSettings, onNewSession, dangerousMode }: Props) {
	return (
		<>
			<Appbar.Header mode="center-aligned" elevated>
				{onOpenSettings ? (
					<Appbar.Action icon="menu" onPress={onOpenSettings} />
				) : (
					<Appbar.Action icon="menu" onPress={() => {}} style={{ opacity: 0 }} disabled />
				)}
				<Appbar.Content title={greeting} titleStyle={{ fontSize: 17, fontWeight: '600' }} />
				<Appbar.Action icon="plus" onPress={onNewSession} />
			</Appbar.Header>
			{dangerousMode ? (
				<View style={styles.dangerBanner}>
					<Text style={styles.dangerText}>⚠ Permissions bypassed</Text>
				</View>
			) : null}
		</>
	);
}

const styles = StyleSheet.create({
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
});
