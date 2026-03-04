import { useState, useRef } from 'react';
import {
  Platform,
  PanResponder,
  View,
  useColorScheme,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '../AppContext';
import { ChatArea } from '../components/ChatArea';
import { EmptyProjectView } from '../components/EmptyProjectView';
import { Header } from '../components/Header';
import { InputBar } from '../components/InputBar';
import { SessionActionModal } from '../components/SessionActionModal';
import { SideDrawer } from '../components/SideDrawer';
import type { Session } from '../types';

export function SessionsScreen() {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [actionSession, setActionSession] = useState<Session | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Holds the session to rename until the drawer modal fully unmounts before opening SessionActionModal
  const pendingRenameRef = useRef<Session | null>(null);

  const {
    sessions,
    currentSessionId,
    messagesBySession,
    input,
    loading,
    error,
    loadingMessages,
    showScrollButton,
    baseDir,
    projects,
    currentProjectId,
    scrollRef,
    setInput,
    setCurrentSessionId,
    setShowScrollButton,
    handleSelectProject,
    handleNewSession,
    handleRenameSession,
    handleDeleteSession,
    dismissError,
    send,
    onScroll,
  } = useAppContext();

  const currentMessages = currentSessionId
    ? (messagesBySession.get(currentSessionId) ?? [])
    : [];

  const currentSession = sessions.find((s) => s.id === currentSessionId) ?? null;
  const isDangerousMode = currentSession?.permissionMode === 'dangerouslySkipPermissions';

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning, Adam' : hour < 18 ? 'Good afternoon, Adam' : 'Good evening, Adam';

  // Thin left-edge zone that listens for rightward swipe to open the drawer
  const edgePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dx > 12 && Math.abs(gs.dy) < Math.abs(gs.dx),
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > 40) setDrawerOpen(true);
      },
    }),
  ).current;

  return (
    <KeyboardAvoidingView
      className={`flex-1 ${isDark ? 'bg-black' : 'bg-gray-50'}`}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Header
        greeting={greeting}
        onOpenSettings={() => setDrawerOpen(true)}
        onNewSession={handleNewSession}
        dangerousMode={isDangerousMode}
      />

      {currentProjectId ? (
        <>
          <ChatArea
            messages={currentMessages}
            loading={loading}
            loadingMessages={loadingMessages}
            error={error}
            onDismissError={dismissError}
            scrollRef={scrollRef}
            showScrollButton={showScrollButton}
            onScrollToBottom={() => {
              scrollRef.current?.scrollToEnd({ animated: true });
              setShowScrollButton(false);
            }}
            onScroll={onScroll}
            bottomOffset={76 + insets.bottom}
          />

          <InputBar
            input={input}
            onChangeInput={setInput}
            onSend={send}
            editable={!!currentSessionId && !loading}
            canSend={!!currentSessionId && !loading && !!input.trim()}
            bottomInset={insets.bottom}
          />
        </>
      ) : (
        <EmptyProjectView
          baseDir={baseDir}
          projects={projects}
          onOpenSettings={() => {}}
          onSelectProject={handleSelectProject}
        />
      )}

      {/* Left-edge swipe zone to open drawer */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 18,
          zIndex: 10,
        }}
        {...edgePanResponder.panHandlers}
      />

      <SideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onAfterClose={() => {
          if (pendingRenameRef.current) {
            setActionSession(pendingRenameRef.current);
            pendingRenameRef.current = null;
          }
        }}
        projects={projects}
        sessions={sessions}
        currentProjectId={currentProjectId}
        currentSessionId={currentSessionId}
        onSelectProject={handleSelectProject}
        onSelectSession={setCurrentSessionId}
        onEditSession={(s) => { pendingRenameRef.current = s; }}
        onNewSession={handleNewSession}
      />

      <SessionActionModal
        session={actionSession}
        onClose={() => setActionSession(null)}
        onRename={handleRenameSession}
        onDelete={handleDeleteSession}
      />
    </KeyboardAvoidingView>
  );
}
