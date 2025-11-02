import { z } from 'zod';

// ============================================================================
// Session Schema
// ============================================================================

export const SessionSchema = z.object({
	id: z.string(),
	model: z.string(),
	createdAt: z.string(),
});

export type Session = z.infer<typeof SessionSchema>;

// ============================================================================
// Client → Server Messages
// ============================================================================

// Discriminated union for all client-to-server messages
export type ClientMessage =
	| { type: 'chat:send'; payload: { message: string; sessionId: string; requestId: string } }
	| { type: 'session:list'; payload: { requestId: string } }
	| { type: 'session:create'; payload: { model?: string; requestId: string } };

// Zod schemas for runtime validation
export const ChatSendSchema = z.object({
	type: z.literal('chat:send'),
	payload: z.object({
		message: z.string().min(1),
		sessionId: z.string(),
		requestId: z.string().uuid(),
	}),
});

export const SessionListSchema = z.object({
	type: z.literal('session:list'),
	payload: z.object({
		requestId: z.string().uuid(),
	}),
});

export const SessionCreateSchema = z.object({
	type: z.literal('session:create'),
	payload: z.object({
		model: z.string().optional(),
		requestId: z.string().uuid(),
	}),
});

// Union schema for runtime validation
export const ClientMessageSchema = z.discriminatedUnion('type', [
	ChatSendSchema,
	SessionListSchema,
	SessionCreateSchema,
]);

// ============================================================================
// Server → Client Messages
// ============================================================================

// Discriminated union for all server-to-client messages
export type ServerMessage =
	| {
			type: 'chat:response';
			payload: { response: string; logs: string[]; sessionId: string; requestId: string };
	  }
	| { type: 'chat:error'; payload: { message: string; code?: string; requestId: string } }
	| { type: 'session:list'; payload: { sessions: Session[]; requestId: string } }
	| { type: 'session:created'; payload: Session & { requestId: string } }
	| { type: 'session:error'; payload: { message: string; code?: string; requestId: string } }
	| { type: 'log'; payload: { sessionId: string; data: string } }
	| { type: 'connection'; payload: { status: string; sessions: Session[] } };

// Zod schemas for runtime validation
export const ChatResponseSchema = z.object({
	type: z.literal('chat:response'),
	payload: z.object({
		response: z.string(),
		logs: z.array(z.string()),
		sessionId: z.string(),
		requestId: z.string().uuid(),
	}),
});

export const ChatErrorSchema = z.object({
	type: z.literal('chat:error'),
	payload: z.object({
		message: z.string(),
		code: z.string().optional(),
		requestId: z.string().uuid(),
	}),
});

export const SessionListResponseSchema = z.object({
	type: z.literal('session:list'),
	payload: z.object({
		sessions: z.array(SessionSchema),
		requestId: z.string().uuid(),
	}),
});

export const SessionCreatedSchema = z.object({
	type: z.literal('session:created'),
	payload: SessionSchema.extend({
		requestId: z.string().uuid(),
	}),
});

export const SessionErrorSchema = z.object({
	type: z.literal('session:error'),
	payload: z.object({
		message: z.string(),
		code: z.string().optional(),
		requestId: z.string().uuid(),
	}),
});

export const LogSchema = z.object({
	type: z.literal('log'),
	payload: z.object({
		sessionId: z.string(),
		data: z.string(),
	}),
});

export const ConnectionSchema = z.object({
	type: z.literal('connection'),
	payload: z.object({
		status: z.string(),
		sessions: z.array(SessionSchema),
	}),
});

// Union schema for runtime validation
export const ServerMessageSchema = z.discriminatedUnion('type', [
	ChatResponseSchema,
	ChatErrorSchema,
	SessionListResponseSchema,
	SessionCreatedSchema,
	SessionErrorSchema,
	LogSchema,
	ConnectionSchema,
]);
