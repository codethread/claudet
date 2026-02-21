import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  useColorScheme,
} from 'react-native';
import type { Session } from '../types';

interface Props {
  session: Session | null;
  onClose: () => void;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function SessionActionModal({ session, onClose, onRename, onDelete }: Props) {
  const isDark = useColorScheme() === 'dark';
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (session) {
      setNameInput(session.name ?? '');
    }
  }, [session]);

  const originalName = session?.name ?? '';
  const trimmed = nameInput.trim();
  const saveDisabled = trimmed === originalName || saving || deleting;

  const handleSave = async () => {
    if (!session || saveDisabled) return;
    setSaving(true);
    try {
      await onRename(session.id, trimmed);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!session || deleting) return;
    setDeleting(true);
    try {
      await onDelete(session.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      visible={session !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={Keyboard.dismiss}
        >
          {/* Sheet */}
          <Pressable
            className={`rounded-t-3xl px-6 pt-2 pb-10 ${isDark ? 'bg-zinc-900' : 'bg-white'}`}
            onPress={() => {}}
          >
            {/* Handle */}
            <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-zinc-600 self-center mb-6" />

            <Text className={`text-[17px] font-semibold mb-5 ${isDark ? 'text-white' : 'text-black'}`}>
              Rename Session
            </Text>

            <TextInput
              className={`rounded-xl px-4 py-3 text-[15px] mb-5 border ${
                isDark
                  ? 'bg-zinc-800 text-white border-zinc-700'
                  : 'bg-gray-50 text-black border-gray-200'
              }`}
              placeholder="Session name"
              placeholderTextColor={isDark ? '#636366' : '#8e8e93'}
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            <View className="flex-row gap-3 mb-4">
              <Pressable
                onPress={onClose}
                className={`flex-1 rounded-xl py-3 items-center ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`}
              >
                <Text className={`text-[15px] font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSave}
                disabled={saveDisabled}
                className={`flex-1 rounded-xl py-3 items-center ${
                  saveDisabled
                    ? isDark ? 'bg-zinc-700' : 'bg-gray-200'
                    : 'bg-[#007AFF]'
                }`}
              >
                <Text className={`text-[15px] font-semibold ${saveDisabled ? isDark ? 'text-zinc-500' : 'text-gray-400' : 'text-white'}`}>
                  {saving ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
            </View>

            <View className={`h-[0.5px] mb-4 ${isDark ? 'bg-zinc-700' : 'bg-gray-200'}`} />

            <Pressable
              onPress={handleDelete}
              disabled={deleting}
              className={`rounded-xl py-3 items-center bg-red-500 ${deleting ? 'opacity-50' : ''}`}
            >
              <Text className="text-white text-[15px] font-semibold">
                {deleting ? 'Deleting…' : 'Delete Session'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
