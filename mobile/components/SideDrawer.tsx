import { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  Animated,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { Project, Session } from '../types';

const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.82, 340);

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
  isOpen: boolean;
  onClose: () => void;
  onAfterClose?: () => void;
  projects: Project[];
  sessions: Session[];
  currentProjectId: string | null;
  currentSessionId: string | null;
  onSelectProject: (id: string) => void;
  onSelectSession: (id: string) => void;
  onEditSession: (session: Session) => void;
  onNewSession: () => void;
}

export function SideDrawer({
  isOpen,
  onClose,
  onAfterClose,
  projects,
  sessions,
  currentProjectId,
  currentSessionId,
  onSelectProject,
  onSelectSession,
  onEditSession,
  onNewSession,
}: Props) {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Ref so the animation completion callback always sees the latest onAfterClose
  const onAfterCloseRef = useRef(onAfterClose);
  useEffect(() => { onAfterCloseRef.current = onAfterClose; }, [onAfterClose]);

  useEffect(() => {
    if (isOpen) {
      setModalVisible(true);
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          bounciness: 0,
          speed: 20,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: -DRAWER_WIDTH,
          bounciness: 0,
          speed: 20,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setModalVisible(false);
          onAfterCloseRef.current?.();
        }
      });
    }
  }, [isOpen, translateX, backdropOpacity]);

  const projectSessions = currentProjectId
    ? sessions.filter((s) => s.projectPath === currentProjectId)
    : [];

  const bg = isDark ? '#1c1c1e' : '#ffffff';
  const textPrimary = isDark ? '#ffffff' : '#000000';
  const textSecondary = isDark ? '#636366' : '#8e8e93';
  const divider = isDark ? '#38383a' : '#e5e5ea';
  const activeBlue = isDark ? '#0a84ff' : '#007AFF';
  const activeBg = isDark ? 'rgba(10,132,255,0.12)' : 'rgba(0,122,255,0.08)';

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Backdrop */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}
          pointerEvents="box-none"
        >
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
            onPress={onClose}
          />
        </Animated.View>

        {/* Drawer panel */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: DRAWER_WIDTH,
            backgroundColor: bg,
            transform: [{ translateX }],
            shadowColor: '#000',
            shadowOffset: { width: 4, height: 0 },
            shadowOpacity: 0.25,
            shadowRadius: 12,
            elevation: 20,
          }}
        >
          {/* Header */}
          <View
            style={{
              paddingTop: insets.top + 20,
              paddingBottom: 14,
              paddingHorizontal: 20,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: divider,
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: '700', color: textPrimary }}>
              Claudet
            </Text>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {/* Projects section */}
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                color: textSecondary,
                paddingHorizontal: 20,
                paddingTop: 18,
                paddingBottom: 6,
              }}
            >
              Projects
            </Text>

            {projects.length === 0 ? (
              <Text
                style={{
                  fontSize: 13,
                  fontStyle: 'italic',
                  color: textSecondary,
                  paddingHorizontal: 20,
                  paddingVertical: 6,
                }}
              >
                No projects — configure in Settings
              </Text>
            ) : (
              projects.map((project) => {
                const active = project.id === currentProjectId;
                return (
                  <Pressable
                    key={project.id}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      onSelectProject(project.id);
                      onClose();
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      backgroundColor: active ? activeBg : 'transparent',
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: active ? activeBlue : 'transparent',
                        marginRight: 12,
                        flexShrink: 0,
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: active ? '600' : '400',
                          color: active ? activeBlue : textPrimary,
                        }}
                        numberOfLines={1}
                      >
                        {project.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: 'monospace',
                          color: textSecondary,
                          marginTop: 1,
                        }}
                        numberOfLines={1}
                      >
                        {project.path}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}

            {/* Sessions section — only shown when a project is selected */}
            {currentProjectId ? (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 20,
                    paddingTop: 20,
                    paddingBottom: 6,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: divider,
                    marginTop: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                      color: textSecondary,
                    }}
                  >
                    Sessions
                  </Text>
                  <Pressable
                    onPress={() => {
                      void Haptics.selectionAsync();
                      onNewSession();
                      onClose();
                    }}
                    hitSlop={12}
                  >
                    <Text style={{ fontSize: 24, lineHeight: 28, color: activeBlue }}>+</Text>
                  </Pressable>
                </View>

                {projectSessions.length === 0 ? (
                  <Text
                    style={{
                      fontSize: 13,
                      fontStyle: 'italic',
                      color: textSecondary,
                      paddingHorizontal: 20,
                      paddingVertical: 6,
                    }}
                  >
                    No sessions yet — tap + to start
                  </Text>
                ) : (
                  projectSessions.map((session) => {
                    const active = session.id === currentSessionId;
                    return (
                      <View
                        key={session.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: active ? activeBg : 'transparent',
                        }}
                      >
                        <Pressable
                          onPress={() => {
                            void Haptics.selectionAsync();
                            onSelectSession(session.id);
                            onClose();
                          }}
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingVertical: 9 }}
                        >
                          <View
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: 2.5,
                              backgroundColor: active ? activeBlue : 'transparent',
                              marginRight: 12,
                              flexShrink: 0,
                            }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: active ? '600' : '400',
                                color: active ? activeBlue : textPrimary,
                              }}
                              numberOfLines={1}
                            >
                              {sessionLabel(session)}
                            </Text>
                            <Text style={{ fontSize: 11, color: textSecondary, marginTop: 1 }}>
                              {session.model}
                            </Text>
                          </View>
                        </Pressable>

                        {/* Edit icon — opens SessionActionModal (rename + delete) */}
                        <Pressable
                          onPress={() => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onClose();
                            onEditSession(session);
                          }}
                          hitSlop={8}
                          style={{ paddingHorizontal: 16, paddingVertical: 9 }}
                        >
                          <Text style={{ fontSize: 16, color: textSecondary }}>✎</Text>
                        </Pressable>
                      </View>
                    );
                  })
                )}
              </>
            ) : null}

            {/* Bottom padding */}
            <View style={{ height: insets.bottom + 24 }} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
