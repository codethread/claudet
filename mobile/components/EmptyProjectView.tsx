import { View, Text, Pressable, ScrollView, StyleSheet, useColorScheme } from 'react-native';
import type { Project } from '../types';

interface Props {
	baseDir: string | null;
	projects: Project[];
	onOpenSettings: () => void;
	onSelectProject: (id: string) => void;
}

export function EmptyProjectView({ baseDir, projects, onOpenSettings, onSelectProject }: Props) {
	const isDark = useColorScheme() === 'dark';
	const text = isDark ? '#fff' : '#000';
	const subtext = isDark ? '#ebebf5aa' : '#666';
	const cardBg = isDark ? '#1c1c1e' : '#fff';
	const border = isDark ? '#3a3a3c' : '#e0e0e0';

	if (!baseDir) {
		return (
			<View style={styles.center}>
				<Text style={[styles.title, { color: text }]}>No base directory set</Text>
				<Text style={[styles.subtitle, { color: subtext }]}>
					Open Settings to choose where your projects live.
				</Text>
				<Pressable style={styles.button} onPress={onOpenSettings}>
					<Text style={styles.buttonText}>Open Settings</Text>
				</Pressable>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<Text style={[styles.title, { color: text }]}>Select a Project</Text>
			<Text style={[styles.subtitle, { color: subtext }]}>~/{baseDir}</Text>

			{projects.length === 0 ? (
				<Text style={[styles.emptyText, { color: subtext }]}>
					No git repositories found in ~/{baseDir}
				</Text>
			) : (
				<ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
					{projects.map((project) => (
						<Pressable
							key={project.id}
							style={[styles.projectRow, { backgroundColor: cardBg, borderColor: border }]}
							onPress={() => onSelectProject(project.id)}
						>
							<Text style={[styles.projectName, { color: text }]}>{project.name}</Text>
							<Text style={[styles.projectPath, { color: subtext }]} numberOfLines={1}>
								{project.path}
							</Text>
						</Pressable>
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
		fontSize: 22,
		fontWeight: '700',
		marginBottom: 8,
		textAlign: 'center',
	},
	subtitle: {
		fontSize: 14,
		marginBottom: 24,
		textAlign: 'center',
	},
	button: {
		backgroundColor: '#007AFF',
		borderRadius: 12,
		paddingVertical: 12,
		paddingHorizontal: 28,
		marginTop: 8,
	},
	buttonText: {
		color: '#fff',
		fontSize: 15,
		fontWeight: '600',
	},
	list: {
		flex: 1,
	},
	listContent: {
		gap: 10,
	},
	projectRow: {
		borderRadius: 12,
		borderWidth: 1,
		padding: 16,
	},
	projectName: {
		fontSize: 16,
		fontWeight: '600',
		marginBottom: 4,
	},
	projectPath: {
		fontSize: 12,
		fontFamily: 'monospace',
	},
	emptyText: {
		textAlign: 'center',
		fontStyle: 'italic',
		marginTop: 16,
	},
});
