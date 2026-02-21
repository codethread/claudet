import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '../AppContext';

function BaseDirInput({
  onSave,
  isDark,
}: {
  onSave: (value: string) => Promise<void>;
  isDark: boolean;
}) {
  const [value, setValue] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(value.trim());
      setValue('');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <View className="flex-row items-center gap-2">
        <Text className={`text-[14px] ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>~/</Text>
        <TextInput
          className={`flex-1 rounded-lg px-3 py-2 text-[14px] border ${
            isDark ? 'bg-zinc-800 text-white border-zinc-700' : 'bg-gray-50 text-black border-gray-200'
          }`}
          placeholder="e.g. dev"
          placeholderTextColor={isDark ? '#636366' : '#8e8e93'}
          value={value}
          onChangeText={setValue}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          onPress={handleSave}
          disabled={saving || !value.trim()}
          className={`rounded-lg px-4 py-2 ${saving || !value.trim() ? 'opacity-50' : ''} bg-[#007AFF]`}
        >
          <Text className="text-white text-[14px] font-semibold">{saving ? '…' : 'Save'}</Text>
        </Pressable>
      </View>
      {saveError ? (
        <Text className="text-red-500 text-[12px] mt-1">{saveError}</Text>
      ) : null}
    </View>
  );
}

function SectionHeader({ label }: { label: string }) {
  const isDark = useColorScheme() === 'dark';
  return (
    <Text className={`text-[12px] font-semibold uppercase tracking-wider px-4 pt-6 pb-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
      {label}
    </Text>
  );
}

export function SettingsScreen() {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();

  const {
    connected,
    baseDir,
    projects,
    currentProjectId,
    selectedModel,
    currentSessionId,
    sessions,
    handleSelectProject,
    handleSaveBaseDir,
    handleSetSessionPermissionMode,
    setSelectedModel,
  } = useAppContext();

  const [editingBaseDir, setEditingBaseDir] = useState(false);

  const currentSession = sessions.find((s) => s.id === currentSessionId) ?? null;
  const permissionMode = currentSession?.permissionMode ?? 'allowEdits';

  const handleSaveBaseDirAndReset = async (value: string) => {
    await handleSaveBaseDir(value);
    setEditingBaseDir(false);
  };

  const cardClass = `rounded-xl border overflow-hidden ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}`;
  const rowClass = `px-4 py-3 flex-row items-center justify-between border-b ${isDark ? 'border-zinc-800' : 'border-gray-100'}`;
  const titleClass = `text-[15px] font-medium ${isDark ? 'text-white' : 'text-black'}`;
  const subtitleClass = `text-[12px] font-mono mt-0.5 ${isDark ? 'text-zinc-400' : 'text-gray-400'}`;

  return (
    <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-gray-50'}`}>
      {/* Title bar */}
      <View
        className={`border-b ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}`}
        style={{ paddingTop: insets.top + 16, paddingBottom: 16, paddingHorizontal: 20 }}
      >
        <Text className={`text-[22px] font-bold mb-2 ${isDark ? 'text-white' : 'text-black'}`}>Settings</Text>
        <View className="flex-row items-center gap-2">
          <View className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <Text className={`text-[13px] ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
            {connected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Base Directory */}
        <SectionHeader label="Base Directory" />
        <View className={`mx-4 ${cardClass}`}>
          <View className="px-4 py-3">
            {baseDir && !editingBaseDir ? (
              <View className="flex-row items-center justify-between">
                <Text className={titleClass}>~/{baseDir}</Text>
                <Pressable onPress={() => setEditingBaseDir(true)}>
                  <Text className="text-[#007AFF] text-[14px]">Edit</Text>
                </Pressable>
              </View>
            ) : (
              <BaseDirInput onSave={handleSaveBaseDirAndReset} isDark={isDark} />
            )}
          </View>
        </View>

        {/* Projects */}
        {baseDir ? (
          <>
            <SectionHeader label="Projects" />
            <View className={`mx-4 ${cardClass}`}>
              {projects.length === 0 ? (
                <Text className={`px-4 py-3 italic ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-[14px]`}>
                  No repos found
                </Text>
              ) : (
                projects.map((project, i) => (
                  <Pressable
                    key={project.id}
                    onPress={() => handleSelectProject(project.id)}
                    className={`${rowClass} ${i === projects.length - 1 ? 'border-b-0' : ''}`}
                  >
                    <View className="flex-1 mr-3">
                      <Text className={titleClass} numberOfLines={1}>{project.name}</Text>
                      <Text className={subtitleClass} numberOfLines={1}>{project.path}</Text>
                    </View>
                    {currentProjectId === project.id && (
                      <Text className="text-[#007AFF] text-[16px] font-bold">✓</Text>
                    )}
                  </Pressable>
                ))
              )}
            </View>
          </>
        ) : null}

        {/* Model */}
        <SectionHeader label="Model" />
        <View className={`mx-4 ${cardClass}`}>
          {['haiku', 'sonnet'].map((model, i) => (
            <Pressable
              key={model}
              onPress={() => setSelectedModel(model)}
              className={`${rowClass} ${i === 1 ? 'border-b-0' : ''}`}
            >
              <Text className={titleClass}>{model.charAt(0).toUpperCase() + model.slice(1)}</Text>
              {selectedModel === model && (
                <Text className="text-[#007AFF] text-[16px] font-bold">✓</Text>
              )}
            </Pressable>
          ))}
        </View>

        {/* Permissions */}
        {currentSessionId ? (
          <>
            <SectionHeader label="Permissions" />
            <View className={`mx-4 ${cardClass}`}>
              <View className={`${rowClass} border-b-0`}>
                <View className="flex-1 mr-3">
                  <Text className={titleClass}>Bypass Permissions</Text>
                  <Text className={subtitleClass}>--dangerously-skip-permissions</Text>
                </View>
                <Switch
                  value={permissionMode === 'dangerouslySkipPermissions'}
                  onValueChange={(val) =>
                    handleSetSessionPermissionMode(val ? 'dangerouslySkipPermissions' : 'allowEdits')
                  }
                  trackColor={{ false: '#767577', true: '#ff9500' }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
