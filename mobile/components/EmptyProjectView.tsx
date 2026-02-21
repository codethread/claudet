import { View, Text, Pressable, ScrollView, useColorScheme } from 'react-native';
import type { Project } from '../types';

interface Props {
  baseDir: string | null;
  projects: Project[];
  onOpenSettings: () => void;
  onSelectProject: (id: string) => void;
}

export function EmptyProjectView({ baseDir, projects, onOpenSettings, onSelectProject }: Props) {
  const isDark = useColorScheme() === 'dark';

  if (!baseDir) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className={`text-[22px] font-bold mb-2 text-center ${isDark ? 'text-white' : 'text-black'}`}>
          No base directory set
        </Text>
        <Text className={`text-[14px] mb-8 text-center ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
          Open Settings to choose where your projects live.
        </Text>
        <Pressable
          onPress={onOpenSettings}
          className="bg-[#007AFF] rounded-xl px-7 py-3"
        >
          <Text className="text-white text-[15px] font-semibold">Open Settings</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 px-6 pt-6">
      <Text className={`text-[22px] font-bold mb-1 text-center ${isDark ? 'text-white' : 'text-black'}`}>
        Select a Project
      </Text>
      <Text className={`text-[14px] mb-6 text-center font-mono ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
        ~/{baseDir}
      </Text>

      {projects.length === 0 ? (
        <Text className={`text-center italic text-[14px] mt-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
          No git repositories found in ~/{baseDir}
        </Text>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ gap: 10 }}>
          {projects.map((project) => (
            <Pressable
              key={project.id}
              onPress={() => onSelectProject(project.id)}
              className={`rounded-xl p-4 border ${
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'
              }`}
            >
              <Text className={`text-[16px] font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                {project.name}
              </Text>
              <Text className={`text-[12px] font-mono ${isDark ? 'text-zinc-400' : 'text-gray-400'}`} numberOfLines={1}>
                {project.path}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
