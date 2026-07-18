const BASE_URL = (import.meta.env.VITE_BACKEND_URL as string || '').replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api/v1`;
const CHAT_URL = `${API_BASE}/chat`;

// React imports for WebSocket hook
import { useRef, useEffect, useCallback, useState } from 'react';

// =====================
// TIPOS
// =====================

export interface MessageResponse {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name?: string;
  content: string;
  created_at: string;
  updated_at?: string;
  status?: 'sending' | 'sent' | 'failed'; // Estado del mensaje (solo frontend)
  tempId?: string; // ID temporal para mensajes pendientes
}

export type ConversationType = 'pre' | 'post' | 'cancelled' | 'rejected';

export interface MessageCreate {
  conversation_id: string;
  content: string;
}

export interface ConversationListItem {
  id: string;
  trip_id?: string;
  driver_id?: string;
  trip_origin_name?: string;
  trip_destination_name?: string;
  other_user_id: string;
  other_user_name: string;
  other_user_avatar?: string;
  subject?: string;
  conversation_type?: ConversationType;
  last_message_content?: string;
  last_message_at?: string;
  unread_count: number;
  has_active_reservation?: boolean;
}

export interface ConversationDetailResponse {
  id: string;
  user_id: string;
  driver_id: string;
  trip_id?: string;
  subject?: string;
  conversation_type?: ConversationType;
  last_message_content?: string;
  last_message_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface ConversationWithMessagesResponse extends ConversationDetailResponse {
  messages: MessageResponse[];
  other_user_name: string;
  other_user_avatar?: string;
  has_active_reservation?: boolean;
  pending_reservation?: PendingReservationInfo;
}

export interface PendingReservationInfo {
  reservation_id: string;
  trip_id: string;
  passenger_id: string;
  passenger_name: string;
  seat_count: number;
  status: string;
  created_at: string;
}

export interface PaginatedMessagesResponse {
  messages: MessageResponse[];
  total: number;
  has_more: boolean;
  oldest_message_date?: string;
}

export interface PaginatedConversationsResponse {
  conversations: ConversationListItem[];
  total: number;
  has_more: boolean;
}

export interface ConversationCreate {
  other_user_id: string;
  trip_id?: string;
  subject?: string;
  conversation_type?: ConversationType;
}

// =====================
// HELPERS
// =====================

const authHeaders = (token?: string) => ({
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': '1',
  ...(token && { Authorization: `Bearer ${token}` }),
});

const handleResponse = async <T>(response: Response): Promise<T> => {
  const result = await response.json();

  if (response.ok) return result as T;

  throw new Error(result?.message || 'Error en la petición');
};

// =====================
// REQUESTS
// =====================

// 💬 GET /chat/conversations (auth)
export const getConversations = async (
  token: string,
  page = 1,
  conversationType?: 'pre' | 'post'
): Promise<PaginatedConversationsResponse> => {
  const params = new URLSearchParams();
  params.append('page', String(page));
  if (conversationType) {
    params.append('conversation_type', conversationType);
  }

  const response = await fetch(
    `${CHAT_URL}/conversations?${params.toString()}`,
    {
      headers: authHeaders(token),
    }
  );

  const result = await handleResponse<PaginatedConversationsResponse>(response);
  console.log('[Chat API] getConversations:', result);
  return result;
};

// ➕ POST /chat/conversations (auth)
export const createConversation = async (
  data: ConversationCreate,
  token: string
): Promise<ConversationDetailResponse> => {
  const response = await fetch(`${CHAT_URL}/conversations`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  const result = await handleResponse<ConversationDetailResponse>(response);
  console.log('[Chat API] createConversation:', result);
  return result;
};

// 📖 GET /chat/conversations/{conversation_id} (auth)
export const getConversation = async (
  conversationId: string,
  token: string
): Promise<ConversationWithMessagesResponse> => {
  const response = await fetch(
    `${CHAT_URL}/conversations/${conversationId}`,
    {
      headers: authHeaders(token),
    }
  );

  const result = await handleResponse<ConversationWithMessagesResponse>(response);
  console.log('[Chat API] getConversation:', result);
  return result;
};

// 📄 GET /chat/conversations/{conversation_id}/messages (auth) - Paginado
export const getMessagesPage = async (
  conversationId: string,
  token: string,
  offsetDate?: string
): Promise<PaginatedMessagesResponse> => {
  const url = new URL(`${CHAT_URL}/conversations/${conversationId}/messages`);
  if (offsetDate) {
    url.searchParams.append('offset_date', offsetDate);
  }

  const response = await fetch(url.toString(), {
    headers: authHeaders(token),
  });

  const result = await handleResponse<PaginatedMessagesResponse>(response);
  console.log('[Chat API] getMessagesPage:', result);
  return result;
};

// 📤 POST /chat/conversations/{conversation_id}/messages (auth)
export const sendMessage = async (
  conversationId: string,
  content: string,
  token: string
): Promise<MessageResponse> => {
  const data: MessageCreate = {
    conversation_id: conversationId,
    content,
  };

  const response = await fetch(
    `${CHAT_URL}/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }
  );

  const result = await handleResponse<MessageResponse>(response);
  console.log('[Chat API] sendMessage:', result);
  return result;
};

// ✅ Aceptar reserva desde el chat
export const acceptReservationFromChat = async (
  conversationId: string,
  reservationId: string,
  token: string
): Promise<any> => {
  const response = await fetch(
    `${CHAT_URL}/conversations/${conversationId}/reservations/${reservationId}/accept`,
    {
      method: 'POST',
      headers: authHeaders(token),
    }
  );

  const result = await handleResponse<any>(response);
  console.log('[Chat API] acceptReservationFromChat:', result);
  return result;
};

// ✅ Rechazar reserva desde el chat
export const rejectReservationFromChat = async (
  conversationId: string,
  reservationId: string,
  token: string
): Promise<any> => {
  const response = await fetch(
    `${CHAT_URL}/conversations/${conversationId}/reservations/${reservationId}/reject`,
    {
      method: 'POST',
      headers: authHeaders(token),
    }
  );

  const result = await handleResponse<any>(response);
  console.log('[Chat API] rejectReservationFromChat:', result);
  return result;
};

// 🗑️ DELETE /chat/conversations/{conversation_id} (auth)
export const deleteConversation = async (
  conversationId: string,
  token: string
): Promise<void> => {
  const response = await fetch(
    `${CHAT_URL}/conversations/${conversationId}`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error?.message || 'Error al eliminar conversación');
  }
};

// 🗑️ DELETE /chat/messages/{message_id} (auth)
export const deleteMessage = async (
  messageId: string,
  token: string
): Promise<void> => {
  const response = await fetch(`${CHAT_URL}/messages/${messageId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error?.message || 'Error al eliminar mensaje');
  }
};

// ✅ POST /chat/conversations/{conversation_id}/read (auth)
export const markConversationAsRead = async (
  conversationId: string,
  token: string
): Promise<{ marked_count: number }> => {
  const response = await fetch(`${CHAT_URL}/conversations/${conversationId}/read`, {
    method: 'POST',
    headers: authHeaders(token),
  });

  const result = await handleResponse<{ marked_count: number }>(response);
  return result;
};
// =====================
// WEBSOCKET
// =====================

export interface WebSocketMessage {
  type: 'message' | 'message_sent' | 'message_confirmed' | 'typing' | 'status' | 'online_users' | 'error' | 'pong' | 'conversation_type_changed';
  id?: string;
  conversation_id?: string;
  conversation_type?: ConversationType;
  sender_id?: string;
  sender_name?: string;
  content?: string;
  created_at?: string;
  pending?: boolean;
  user_id?: string;
  status?: 'online' | 'offline';
  message?: string;
  is_typing?: boolean;
  users?: string[];
  temp_id?: string; // ID temporal del mensaje enviado (para confirmación)
}

export class ChatWebSocket {
  public ws: WebSocket | null = null; // Cambiado a public para poder acceder desde waitForConnection
  public readonly conversationId: string; // Exponer para comparación
  private userId: string;
  private token: string;
  private onMessage: (message: WebSocketMessage) => void;
  private onError: (error: Event) => void;
  private onClose: (event: CloseEvent) => void;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 2000; // 2 seconds base
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private isReconnecting = false;
  private isManuallyDisconnected = false;

  constructor(
    conversationId: string,
    userId: string,
    token: string,
    onMessage: (message: WebSocketMessage) => void,
    onError: (error: Event) => void = () => { },
    onClose: (event: CloseEvent) => void = () => { }
  ) {
    this.conversationId = conversationId;
    this.userId = userId;
    this.token = token;
    this.onMessage = onMessage;
    this.onError = onError;
    this.onClose = onClose;
  }

  connect(): void {
    // Build WebSocket URL robustly based on VITE_BACKEND_URL and current page protocol
    const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const BACKEND_HOST = BASE_URL.replace(/^https?:\/\//, ''); // e.g. "localhost:8000"
    const tokenQuery = this.token ? `?token=${encodeURIComponent(this.token)}` : '';
    const wsUrl = `${WS_PROTOCOL}://${BACKEND_HOST}/api/v1/chat/ws/chat/${this.conversationId}/${this.userId}${tokenQuery}`;

    try {
      console.log('[ChatWebSocket] connecting', { wsUrl, conversationId: this.conversationId, userId: this.userId, tokenProvided: !!this.token });
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = (ev) => {
        console.log('[ChatWebSocket] onopen', {
          conversationId: this.conversationId,
          readyState: this.ws?.readyState,
          ev,
          isConnected: this.isConnected()
        });
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.isManuallyDisconnected = false;
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.onMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[ChatWebSocket] onerror', { error });
        this.onError(error);
      };

      this.ws.onclose = (event) => {
        console.warn('[ChatWebSocket] onclose', { code: event.code, reason: event.reason, wasClean: event.wasClean, readyState: this.ws?.readyState });
        this.onClose(event);

        // Limpiar timeout anterior si existe
        if (this.reconnectTimeoutId) {
          clearTimeout(this.reconnectTimeoutId);
          this.reconnectTimeoutId = null;
        }

        // No reconectar si fue desconexión manual o si ya estamos reconectando
        if (this.isManuallyDisconnected || this.isReconnecting) {
          return;
        }

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.isReconnecting = true;

          // Backoff exponencial: 2s, 4s, 8s, 16s, 32s
          const delay = Math.min(this.reconnectInterval * Math.pow(2, this.reconnectAttempts), 30000);

          this.reconnectTimeoutId = setTimeout(() => {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts}) after ${delay}ms`);
            this.reconnectTimeoutId = null;
            this.connect();
          }, delay);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('[ChatWebSocket] Max reconnection attempts reached. Stopping reconnection.');
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.onError(error as Event);
    }
  }

  sendMessage(content: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'message',
        content: content.trim(),
      };
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  sendTyping(isTyping: boolean): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'typing',
        is_typing: isTyping,
      };
      this.ws.send(JSON.stringify(message));
    }
  }

  sendPing(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'ping',
      };
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    this.isManuallyDisconnected = true;

    // Limpiar timeout de reconexión
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }

    this.isReconnecting = false;
    this.reconnectAttempts = 0;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Hook para usar WebSocket en React
export const useChatWebSocket = (
  conversationId: string | null,
  userId: string,
  token: string,
  onMessage: (message: WebSocketMessage) => void
) => {
  const wsRef = useRef<ChatWebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const conversationIdRef = useRef(conversationId);

  // Mantener el callback actualizado sin recrear la conexión
  useEffect(() => {
    onMessageRef.current = onMessage;
    conversationIdRef.current = conversationId;
  }, [onMessage, conversationId]);

  useEffect(() => {
    if (conversationId && userId && token) {
      // Disconnect previous connection si cambió la conversación
      if (wsRef.current && wsRef.current.conversationId !== conversationId) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }

      // Solo crear nueva conexión si no existe o si cambió la conversación
      if (!wsRef.current || wsRef.current.conversationId !== conversationId) {
        // Create new connection
        wsRef.current = new ChatWebSocket(
          conversationId,
          userId,
          token,
          (message) => onMessageRef.current(message), // Usar ref para evitar recrear conexión
          (error) => console.error('WebSocket error:', error),
          (event) => console.log('WebSocket closed:', event)
        );

        wsRef.current.connect();

        // Set up ping interval to keep connection alive
        const pingInterval = setInterval(() => {
          if (wsRef.current?.isConnected()) {
            wsRef.current.sendPing();
          }
        }, 30000); // Ping every 30 seconds

        return () => {
          clearInterval(pingInterval);
          if (wsRef.current) {
            wsRef.current.disconnect();
            wsRef.current = null;
          }
        };
      }
    } else {
      // Si no hay conversación, desconectar
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    };
  }, [conversationId, userId, token]); // Removido onMessage de las dependencias

  const sendMessage = useCallback((content: string) => {
    if (wsRef.current) {
      wsRef.current.sendMessage(content);
    }
  }, []);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (wsRef.current) {
      wsRef.current.sendTyping(isTyping);
    }
  }, []);

  // Estado de conexión para React
  const [isConnected, setIsConnected] = useState(false);

  // Actualizar estado de conexión cuando cambia
  useEffect(() => {
    const checkConnection = () => {
      const connected = wsRef.current?.isConnected() || false;
      setIsConnected(connected);
    };

    // Verificar periódicamente el estado de conexión (cada 200ms)
    const interval = setInterval(checkConnection, 200);

    // Verificar inmediatamente
    checkConnection();

    // También verificar cuando el WebSocket se abre/cierra
    // Esto se maneja en el ChatWebSocket class, pero podemos escuchar eventos
    return () => clearInterval(interval);
  }, [conversationId]);

  // Escuchar cambios en el estado del WebSocket cuando se conecta/desconecta
  useEffect(() => {
    if (!conversationId || !userId || !token) {
      setIsConnected(false);
      return;
    }

    // Verificar estado inicial
    const checkInitial = () => {
      setIsConnected(wsRef.current?.isConnected() || false);
    };

    // Verificar después de un pequeño delay para dar tiempo a que se establezca la conexión
    const timeout = setTimeout(checkInitial, 500);

    return () => clearTimeout(timeout);
  }, [conversationId, userId, token]);

  const waitForConnection = useCallback(async (maxWaitMs: number = 5000): Promise<boolean> => {
    const startTime = Date.now();
    console.log('[useChatWebSocket] waitForConnection iniciado', {
      conversationId,
      hasWs: !!wsRef.current,
      isConnected: wsRef.current?.isConnected()
    });

    while (Date.now() - startTime < maxWaitMs) {
      // Verificar si el WebSocket existe y está conectado
      if (wsRef.current?.isConnected()) {
        console.log('[useChatWebSocket] WebSocket conectado después de', Date.now() - startTime, 'ms');
        setIsConnected(true);
        return true;
      }

      // Si no existe el WebSocket aún, esperar un poco más
      if (!wsRef.current) {
        console.log('[useChatWebSocket] WebSocket aún no creado, esperando...');
      } else {
        const state = wsRef.current.ws?.readyState;
        console.log('[useChatWebSocket] WebSocket existe pero no conectado, readyState:', state);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const connected = wsRef.current?.isConnected() || false;
    console.log('[useChatWebSocket] waitForConnection terminado', {
      connected,
      elapsed: Date.now() - startTime,
      hasWs: !!wsRef.current,
      readyState: wsRef.current?.ws?.readyState
    });
    setIsConnected(connected);
    return connected;
  }, [conversationId]);

  return {
    sendMessage,
    sendTyping,
    isConnected,
    waitForConnection,
  };
};