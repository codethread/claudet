import { View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useColorScheme } from 'react-native';
import type { Message } from '../types';

interface Props {
  message: Message;
}

export function ChatMessage({ message }: Props) {
  const isDark = useColorScheme() === 'dark';
  const isUser = message.role === 'user';

  const userMarkdownStyles = {
    body: { color: '#ffffff', fontSize: 15, lineHeight: 22 },
    code_inline: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, paddingHorizontal: 4, color: '#ffffff' },
    fence: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: 10, color: '#ffffff' },
    code_block: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: 10, color: '#ffffff' },
    link: { color: '#cce0ff' },
    strong: { color: '#ffffff' },
    em: { color: '#ffffff' },
  };

  const assistantMarkdownStyles = {
    body: { color: isDark ? '#ffffff' : '#000000', fontSize: 15, lineHeight: 22 },
    code_inline: { backgroundColor: isDark ? '#3a3a3c' : '#f0f0f0', borderRadius: 4, paddingHorizontal: 4, color: isDark ? '#e0e0e0' : '#000000' },
    fence: { backgroundColor: isDark ? '#1c1c1e' : '#f5f5f5', borderRadius: 8, padding: 10, color: isDark ? '#e0e0e0' : '#000000' },
    code_block: { backgroundColor: isDark ? '#1c1c1e' : '#f5f5f5', borderRadius: 8, padding: 10, color: isDark ? '#e0e0e0' : '#000000' },
    link: { color: isDark ? '#64b5f6' : '#007AFF' },
  };

  return (
    <View className={`flex-row my-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <View
        className={[
          'max-w-[95%] px-[14px] py-[10px] shrink',
          isUser
            ? 'bg-[#007AFF] rounded-[18px] rounded-br-[4px]'
            : isDark
              ? 'bg-zinc-800 border border-zinc-700 rounded-[18px] rounded-bl-[4px]'
              : 'bg-white border border-gray-200 rounded-[18px] rounded-bl-[4px]',
        ].join(' ')}
      >
        <Markdown style={isUser ? userMarkdownStyles : assistantMarkdownStyles}>
          {message.content}
        </Markdown>
      </View>
    </View>
  );
}
