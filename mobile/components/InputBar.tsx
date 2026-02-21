import { View, TextInput, Pressable, Text, useColorScheme } from 'react-native';
import * as Haptics from 'expo-haptics';

interface Props {
  input: string;
  onChangeInput: (text: string) => void;
  onSend: () => void;
  editable: boolean;
  canSend: boolean;
  bottomInset: number;
}

export function InputBar({ input, onChangeInput, onSend, editable, canSend, bottomInset }: Props) {
  const isDark = useColorScheme() === 'dark';

  return (
    <View
      className={`flex-row items-end px-3 pt-2 gap-2 border-t ${
        isDark
          ? 'bg-black border-zinc-800'
          : 'bg-white border-gray-200'
      }`}
      style={{ paddingBottom: 12 + bottomInset }}
    >
      <TextInput
        className={`flex-1 min-h-[40px] max-h-[120px] rounded-full px-4 py-[10px] text-[15px] ${
          isDark ? 'bg-zinc-800 text-white' : 'bg-gray-100 text-black'
        }`}
        value={input}
        onChangeText={onChangeInput}
        placeholder="Message..."
        placeholderTextColor={isDark ? '#636366' : '#8e8e93'}
        multiline
        editable={editable}
      />
      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onSend();
        }}
        disabled={!canSend}
        className={`w-[36px] h-[36px] rounded-full items-center justify-center mb-[2px] ${
          canSend ? 'bg-[#007AFF]' : isDark ? 'bg-zinc-700' : 'bg-gray-200'
        }`}
      >
        <Text className={`text-[18px] font-bold ${canSend ? 'text-white' : isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
          ↑
        </Text>
      </Pressable>
    </View>
  );
}
