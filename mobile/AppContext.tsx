import { createContext, useContext } from 'react';
import type { RefObject } from 'react';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import type { Message, PermissionMode, Project, Session } from './types';

export type ScrollHandle = {
	scrollToEnd: (params?: { animated?: boolean }) => void;
};

export interface AppState {
	// Data
	sessions: Session[];
	currentSessionId: string | null;
	messagesBySession: Map<string, Message[]>;
	selectedModel: string;
	input: string;
	loading: boolean;
	error: string | null;
	connected: boolean;
	showScrollButton: boolean;
	loadingMessages: boolean;
	baseDir: string | null;
	projects: Project[];
	currentProjectId: string | null;
	// Handlers
	dismissError: () => void;
	setInput: (v: string) => void;
	setCurrentSessionId: (id: string | null) => void;
	setSelectedModel: (m: string) => void;
	handleSelectProject: (id: string) => void;
	handleNewSession: () => Promise<void>;
	handleSaveBaseDir: (value: string) => Promise<void>;
	handleSetSessionPermissionMode: (mode: PermissionMode) => Promise<void>;
	handleRenameSession: (id: string, name: string) => Promise<void>;
	handleDeleteSession: (id: string) => Promise<void>;
	send: () => Promise<void>;
	scrollRef: RefObject<ScrollHandle | null>;
	setShowScrollButton: (v: boolean) => void;
	onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const defaultState: AppState = {
	sessions: [],
	currentSessionId: null,
	messagesBySession: new Map(),
	selectedModel: 'haiku',
	input: '',
	loading: false,
	error: null,
	connected: false,
	showScrollButton: false,
	loadingMessages: false,
	baseDir: null,
	projects: [],
	currentProjectId: null,
	dismissError: () => {},
	setInput: () => {},
	setCurrentSessionId: () => {},
	setSelectedModel: () => {},
	handleSelectProject: () => {},
	handleNewSession: async () => {},
	handleSaveBaseDir: async () => {},
	handleSetSessionPermissionMode: async () => {},
	handleRenameSession: async () => {},
	handleDeleteSession: async () => {},
	send: async () => {},
	scrollRef: { current: null },
	setShowScrollButton: () => {},
	onScroll: () => {},
};

export const AppContext = createContext<AppState>(defaultState);

export function useAppContext(): AppState {
	return useContext(AppContext);
}
