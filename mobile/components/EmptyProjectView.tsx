import { View, StyleSheet } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { ScrollView } from 'react-native';
import type { Project } from '../types';

interface Props {
	baseDir: string | null;
	projects: Project[];
	onOpenSettings: () => void;
	onSelectProject: (id: string) => void;
}

export function EmptyProjectView({ baseDir, projects, onOpenSettings, onSelectProject }: Props) {
	const theme = useTheme();

	if (!baseDir) {
		return (
			<View style={styles.center}>
				<Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
					No base directory set
				</Text>
				<Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
					Open Settings to choose where your projects live.
				</Text>
				<Button mode="contained" onPress={onOpenSettings} style={styles.button}>
					Open Settings
				</Button>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
				Select a Project
			</Text>
			<Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
				~/{baseDir}
			</Text>

			{projects.length === 0 ? (
				<Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
					No git repositories found in ~/{baseDir}
				</Text>
			) : (
				<ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
					{projects.map((project) => (
						<Button
							key={project.id}
							mode="outlined"
							onPress={() => onSelectProject(project.id)}
							style={styles.projectRow}
							contentStyle={styles.projectRowContent}
						>
							{project.name}
						</Button>
					))}
				</ScrollView>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 32,
	},
	container: {
		flex: 1,
		padding: 24,
	},
	title: {
		marginBottom: 8,
		textAlign: 'center',
	},
	subtitle: {
		marginBottom: 24,
		textAlign: 'center',
	},
	button: {
		marginTop: 8,
		borderRadius: 12,
	},
	list: {
		flex: 1,
	},
	listContent: {
		gap: 10,
	},
	projectRow: {
		borderRadius: 12,
	},
	projectRowContent: {
		alignItems: 'flex-start',
		paddingVertical: 8,
	},
	emptyText: {
		textAlign: 'center',
		fontStyle: 'italic',
		marginTop: 16,
	},
});
