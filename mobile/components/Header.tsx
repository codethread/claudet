import { View, Text, Pressable, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  greeting: string;
  onOpenSettings?: () => void;
  onNewSession: () => void;
  dangerousMode?: boolean;
}

export function Header({ greeting, onOpenSettings, onNewSession, dangerousMode }: Props) {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();

  return (
    <View className={isDark ? 'bg-black border-b border-zinc-800' : 'bg-white border-b border-gray-200'}>
      <View
        className="flex-row items-center justify-between px-4 pb-3"
        style={{ paddingTop: insets.top + 12 }}
      >
        {onOpenSettings ? (
          <Pressable
            onPress={onOpenSettings}
            hitSlop={12}
            className="min-w-[36px] items-center"
          >
            <Text className={`text-[22px] ${isDark ? 'text-white' : 'text-black'}`}>☰</Text>
          </Pressable>
        ) : (
          <View className="min-w-[36px]" />
        )}

        <Text
          className={`flex-1 text-[17px] font-semibold text-center mx-2 ${isDark ? 'text-white' : 'text-black'}`}
          numberOfLines={1}
        >
          {greeting}
        </Text>

        <Pressable
          onPress={onNewSession}
          hitSlop={12}
          className="min-w-[36px] items-center"
        >
          <Text className={`text-[26px] leading-[30px] ${isDark ? 'text-[#0a84ff]' : 'text-[#007AFF]'}`}>+</Text>
        </Pressable>
      </View>

      {dangerousMode ? (
        <View className="bg-orange-500 py-1 px-4 items-center">
          <Text className="text-white text-[12px] font-semibold">⚠ Permissions bypassed</Text>
        </View>
      ) : null}
    </View>
  );
}
