import { ScrollView, View, Text, Pressable, useColorScheme } from 'react-native';
import type { Session } from '../types';

function sessionLabel(session: Session): string {
  if (session.name) return session.name;
  const d = new Date(session.createdAt);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

interface Props {
  sessions: Session[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onLongPressSession: (session: Session) => void;
}

export function SessionStrip({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onLongPressSession,
}: Props) {
  const isDark = useColorScheme() === 'dark';

  return (
    <View
      className={`border-b ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}
      >
        {sessions.map((session) => {
          const active = session.id === currentSessionId;
          return (
            <Pressable
              key={session.id}
              onPress={() => onSelectSession(session.id)}
              onLongPress={() => onLongPressSession(session)}
              className={[
                'rounded-full px-4 py-[6px] items-center max-w-[140px]',
                active
                  ? isDark ? 'bg-[#0a84ff]' : 'bg-[#007AFF]'
                  : isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-white border border-gray-200',
              ].join(' ')}
            >
              <Text
                className={`text-[13px] font-medium ${active ? 'text-white' : isDark ? 'text-white' : 'text-black'}`}
                numberOfLines={1}
              >
                {sessionLabel(session)}
              </Text>
              <Text
                className={`text-[10px] mt-[1px] ${active ? 'text-blue-100' : isDark ? 'text-zinc-400' : 'text-gray-400'}`}
              >
                {session.model}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          onPress={onNewSession}
          className={[
            'rounded-full px-4 py-[6px] items-center justify-center',
            isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-white border border-gray-200',
          ].join(' ')}
        >
          <Text className={`text-[18px] leading-[22px] ${isDark ? 'text-zinc-300' : 'text-gray-500'}`}>+</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
