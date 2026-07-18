import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, MessageCircle, Loader2, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { UserProfilePopup } from '@/components/UserProfilePopup';
import { User } from '@/types';
import { useUserProfile, convertProfileToUser } from '@/hooks/use-user-profile-cache';
import type {
  ConversationListItem as ConversationListItemType,
} from '@/services/chat';
import {
  ConversationWithMessagesResponse,
  MessageResponse,
  ConversationType,
  useChatWebSocket,
  WebSocketMessage,
  getMessagesPage,
  markConversationAsRead,
  acceptReservationFromChat,
  rejectReservationFromChat,
} from '@/services/chat';
import {
  useConversations,
  useConversation,
  useCreateConversation,
  useSendMessage,
  useUpdateConversationCache,
  chatKeys,
} from '@/hooks/use-chat-cache';
import type { PaginatedConversationsResponse, PendingReservationInfo } from '@/services/chat';
import { useQueryClient } from '@tanstack/react-query';

// ✅ Componente para acciones de reserva pendiente (aceptar/rechazar)
const PendingReservationActions: React.FC<{
  conversationId: string;
  reservation: PendingReservationInfo;
  accessToken: string | null;
  onActionComplete: () => void;
}> = ({ conversationId, reservation, accessToken, onActionComplete }) => {
  const [isLoading, setIsLoading] = useState<'accept' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!accessToken) return;
    setIsLoading('accept');
    setError(null);
    try {
      await acceptReservationFromChat(conversationId, reservation.reservation_id, accessToken);
      onActionComplete();
    } catch (err: any) {
      setError(err.message || 'Error al aceptar la reserva');
    } finally {
      setIsLoading(null);
    }
  };

  const handleReject = async () => {
    if (!accessToken) return;
    setIsLoading('reject');
    setError(null);
    try {
      await rejectReservationFromChat(conversationId, reservation.reservation_id, accessToken);
      onActionComplete();
    } catch (err: any) {
      setError(err.message || 'Error al rechazar la reserva');
    } finally {
      setIsLoading(null);
    }
  };

  if (reservation.status !== 'pending') {
    return null; // No mostrar si no hay reserva pendiente
  }

  return (
    <div className="flex items-center gap-1">
      {error && (
        <span className="text-xs text-red-500 mr-1">{error}</span>
      )}
      <button
        onClick={handleAccept}
        disabled={isLoading !== null}
        className="px-2 py-1 text-xs font-medium bg-green-500 hover:bg-green-600 text-white rounded transition-colors disabled:opacity-50"
      >
        {isLoading === 'accept' ? '...' : 'Aceptar'}
      </button>
      <button
        onClick={handleReject}
        disabled={isLoading !== null}
        className="px-2 py-1 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded transition-colors disabled:opacity-50"
      >
        {isLoading === 'reject' ? '...' : 'Rechazar'}
      </button>
    </div>
  );
};

// Componente para cada item de conversación en la lista
const ConversationListItem: React.FC<{
  conversation: ConversationListItemType;
  onSelect: () => void;
  popupConversationId: string | null;
  setPopupConversationId: (id: string | null) => void;
  accessToken: string | null;
}> = ({ conversation, onSelect, popupConversationId, setPopupConversationId, accessToken }) => {
  const isPopupOpen = popupConversationId === conversation.id;
  const conversationOtherUserId = conversation.other_user_id;
  const navigateToTrip = useNavigate();
  const { user: currentUser } = useAuth();

  // Obtener perfil del usuario de esta conversación con caché
  const { data: conversationUserProfileData } = useUserProfile(
    conversationOtherUserId,
    isPopupOpen && !!conversationOtherUserId && !!accessToken
  );

  // Convertir perfil a User
  const conversationUserProfile: User | null = useMemo(() => {
    if (!conversationOtherUserId) return null;

    if (conversationUserProfileData) {
      return convertProfileToUser(
        conversationUserProfileData,
        conversation.other_user_name,
        conversation.other_user_avatar
      );
    }

    // Fallback: usar datos básicos de la conversación
    return {
      id: conversationOtherUserId,
      full_name: conversation.other_user_name,
      email: '',
      avatar: conversation.other_user_avatar || undefined,
      rating: 5.0,
      tripsCompleted: 0,
      is_driver: false,
      user_role: 'user' as const,
      total_trips_as_driver: undefined,
      total_trips_as_passenger: undefined,
    };
  }, [conversationUserProfileData, conversation]);

  return (
    <div className="w-full flex items-center gap-3 p-4 bg-card rounded-2xl hover:shadow-md transition-all duration-200">
      <UserProfilePopup
        user={conversationUserProfile}
        open={isPopupOpen}
        onOpenChange={(open) => {
          setPopupConversationId(open ? conversation.id : null);
        }}
        side="right"
        align="start"
        trigger={
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity">
              {conversation.other_user_avatar ? (
                <img
                  src={conversation.other_user_avatar}
                  alt={conversation.other_user_name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <span className="text-primary font-semibold">
                  {conversation.other_user_name.split(' ').map(n => n[0]).join('')}
                </span>
              )}
            </div>
            {conversation.unread_count > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
                {conversation.unread_count}
              </span>
            )}
          </div>
        }
      />
      <button
        onClick={onSelect}
        className="flex-1 flex items-center gap-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground">{conversation.other_user_name}</p>
            <span
              onClick={(e) => {
                if (conversation.trip_id) {
                  e.stopPropagation();
                  const isDriver = conversation.driver_id && currentUser?.id === conversation.driver_id;
                  navigateToTrip(isDriver
                    ? `/my-trips/manage/${conversation.trip_id}`
                    : `/trip-details/${conversation.trip_id}`
                  );
                }
              }}
              className={`text-xs font-bold ml-auto cursor-pointer ${conversation.conversation_type === 'cancelled'
                ? 'text-red-600 dark:text-red-400'
                : conversation.conversation_type === 'rejected'
                  ? 'text-orange-600 dark:text-orange-400'
                  : conversation.conversation_type === 'post'
                    ? 'text-green-600 dark:text-green-400'
                    : conversation.has_active_reservation
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-muted-foreground'
                } ${conversation.trip_id ? 'hover:underline' : 'cursor-default'}`}
            >
              {conversation.conversation_type === 'cancelled'
                ? 'Cancelada'
                : conversation.conversation_type === 'rejected'
                  ? 'Rechazada'
                  : conversation.conversation_type === 'post'
                    ? 'Viaje confirmado'
                    : conversation.has_active_reservation
                      ? 'Solicitud previa'
                      : 'Consulta previa'}
            </span>
          </div>
          {conversation.trip_origin_name && conversation.trip_destination_name && (
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground line-clamp-1 flex-1">
                {conversation.trip_origin_name} → {conversation.trip_destination_name}
              </p>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {conversation.last_message_at
                  ? new Date(conversation.last_message_at).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })
                  : ''
                }
              </span>
            </div>
          )}
          <p className="text-sm text-muted-foreground line-clamp-1">
            {conversation.last_message_content || 'Sin mensajes'}
          </p>
        </div>
      </button>
    </div>
  );
};

const Messages: React.FC = () => {
  const { accessToken, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [conversationTypeFilter, setConversationTypeFilter] = useState<'pre' | 'post' | undefined>(undefined);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isCurrentlyTyping, setIsCurrentlyTyping] = useState(false); // Estado local para evitar enviar múltiples "true"
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isUserProfilePopupOpen, setIsUserProfilePopupOpen] = useState(false);
  const [popupConversationId, setPopupConversationId] = useState<string | null>(null);

  // ✅ Usar React Query para cachear conversaciones
  const { data: conversationsData, isLoading: isLoadingConversations, refetch: refetchConversations } = useConversations(currentPage, conversationTypeFilter);
  const conversations = conversationsData?.conversations || [];
  const hasMoreConversations = conversationsData?.has_more || false;

  // ✅ Usar React Query para cachear conversación seleccionada
  const { data: selectedConversation, isLoading: isLoadingMessages, refetch: refetchSelectedConversation } = useConversation(selectedConversationId);

  // ⚠️ TEMPORAL: Refetchear listado cada vez que se monta el componente
  useEffect(() => {
    console.log('[Messages] 🔄 Refetcheando listado de conversaciones al montar');
    refetchConversations();
  }, []); // Solo al montar

  // ⚠️ TEMPORAL: Refetchear conversación específica cada vez que se selecciona
  useEffect(() => {
    if (selectedConversationId) {
      console.log('[Messages] 🔄 Refetcheando conversación específica:', selectedConversationId);
      refetchSelectedConversation();
    }
  }, [selectedConversationId, refetchSelectedConversation]);

  // ✅ queryClient debe declararse antes de usarse en useEffect
  const queryClient = useQueryClient();

  // Hooks para mutaciones (deben declararse antes de usarse)
  const createConversationMutation = useCreateConversation();
  // ✅ Ya no usamos sendMessageMutation - solo WebSocket para mensajes
  const { addMessageToCache } = useUpdateConversationCache();

  // Helper para emitir contador de conversaciones sin leer (debe declararse antes de usarse)
  const emitUnreadConversationsCount = useCallback((convs: ConversationListItemType[]) => {
    const count = convs.filter(c => c.unread_count > 0).length;
    try {
      window.dispatchEvent(new CustomEvent('app:unread-conversations-count', { detail: { count } }));
    } catch (e) {
      console.warn('Could not dispatch unread count event', e);
    }
  }, []);

  // ✅ Actualizar unread_count cuando se carga una conversación (el backend ya marca como leída)
  useEffect(() => {
    if (selectedConversationId && selectedConversation) {
      // El backend ya marca como leída al cargar, actualizar caché local
      queryClient.setQueriesData<PaginatedConversationsResponse>(
        { queryKey: chatKeys.conversations() },
        (old) => {
          if (!old) return old;
          const updatedConversations = old.conversations.map((conv) =>
            conv.id === selectedConversationId
              ? { ...conv, unread_count: 0 }
              : conv
          );

          // Actualizar contador global
          emitUnreadConversationsCount(updatedConversations);

          return {
            ...old,
            conversations: updatedConversations,
          };
        }
      );
    }
  }, [selectedConversationId, selectedConversation, queryClient, emitUnreadConversationsCount]);

  // Estado de envío de mensaje (solo creación de conversación, mensajes por WebSocket)
  const isSendingMessage = createConversationMutation.isPending;

  // Mensajes ordenados
  const messages = selectedConversation?.messages
    ? [...selectedConversation.messages].sort((a, b) => {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    })
    : [];

  // Cargar contadores persistidos
  const getPersistedUnreadCounts = useCallback(() => {
    try {
      const stored = localStorage.getItem('unread_counts');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }, []);

  const setPersistedUnreadCount = useCallback((conversationId: string, count: number) => {
    try {
      const counts = getPersistedUnreadCounts();
      if (count > 0) {
        counts[conversationId] = count;
      } else {
        delete counts[conversationId];
      }
      localStorage.setItem('unread_counts', JSON.stringify(counts));
    } catch (e) {
      console.warn('Error persisting unread count', e);
    }
  }, [getPersistedUnreadCounts]);

  // WebSocket para mensajes en tiempo real
  const handleWebSocketMessage = useCallback((wsMessage: WebSocketMessage) => {
    console.log('WebSocket message received:', wsMessage);

    switch (wsMessage.type) {
      case 'message_sent':
      case 'message_confirmed':
        // ✅ Confirmación de mensaje enviado por el usuario actual
        if (wsMessage.conversation_id && wsMessage.id && wsMessage.sender_id === user?.id) {
          queryClient.setQueryData<ConversationWithMessagesResponse>(
            chatKeys.conversation(wsMessage.conversation_id),
            (old) => {
              if (!old) return old;

              // Buscar mensaje temporal por contenido y timestamp (dentro de 5 segundos)
              const tempMessageIndex = old.messages.findIndex(
                (m) => m.status === 'sending' &&
                  m.content === wsMessage.content &&
                  m.sender_id === user?.id &&
                  Math.abs(new Date(m.created_at).getTime() - new Date(wsMessage.created_at || '').getTime()) < 5000
              );

              if (tempMessageIndex !== -1) {
                // Limpiar timeout si existe
                const tempMsg = old.messages[tempMessageIndex];
                if ((tempMsg as any).timeoutId) {
                  clearTimeout((tempMsg as any).timeoutId);
                }

                // Reemplazar mensaje temporal con el real
                const newMessages = [...old.messages];
                newMessages[tempMessageIndex] = {
                  id: wsMessage.id!,
                  conversation_id: wsMessage.conversation_id,
                  sender_id: wsMessage.sender_id || '',
                  sender_name: wsMessage.sender_name,
                  content: wsMessage.content || '',
                  created_at: wsMessage.created_at || new Date().toISOString(),
                  updated_at: wsMessage.created_at,
                  status: 'sent',
                };

                return {
                  ...old,
                  messages: newMessages,
                  last_message_content: wsMessage.content || old.last_message_content,
                  last_message_at: wsMessage.created_at || old.last_message_at,
                };
              }

              // Si no se encuentra el temporal, agregar como nuevo (por si acaso)
              const newMessage: MessageResponse = {
                id: wsMessage.id!,
                conversation_id: wsMessage.conversation_id,
                sender_id: wsMessage.sender_id || '',
                sender_name: wsMessage.sender_name,
                content: wsMessage.content || '',
                created_at: wsMessage.created_at || new Date().toISOString(),
                updated_at: wsMessage.created_at,
                status: 'sent',
              };

              // Verificar que no existe ya
              const exists = old.messages.some(m => m.id === wsMessage.id);
              if (!exists) {
                return {
                  ...old,
                  messages: [...old.messages, newMessage],
                  last_message_content: wsMessage.content || old.last_message_content,
                  last_message_at: wsMessage.created_at || old.last_message_at,
                };
              }

              return old;
            }
          );
        }
        break;

      case 'message':
        // ✅ Mensajes de otros usuarios o broadcast
        if (wsMessage.conversation_id && wsMessage.id) {
          // Solo agregar si NO es del usuario actual (para evitar duplicados de confirmación)
          if (wsMessage.sender_id !== user?.id) {
            const newMessage: MessageResponse = {
              id: wsMessage.id,
              conversation_id: wsMessage.conversation_id,
              sender_id: wsMessage.sender_id || '',
              sender_name: wsMessage.sender_name,
              content: wsMessage.content || '',
              created_at: wsMessage.created_at || new Date().toISOString(),
              updated_at: wsMessage.created_at,
              status: 'sent',
            };
            addMessageToCache(wsMessage.conversation_id, newMessage);

            // ✅ Si estás viendo esta conversación, marcar como leído automáticamente
            if (selectedConversationId === wsMessage.conversation_id && accessToken) {
              // Marcar como leído en el backend (sin esperar respuesta para no bloquear)
              markConversationAsRead(wsMessage.conversation_id, accessToken).catch((error) => {
                console.error('Error marcando mensaje como leído:', error);
              });

              // Actualizar caché local inmediatamente (optimistic update)
              queryClient.setQueriesData<PaginatedConversationsResponse>(
                { queryKey: chatKeys.conversations() },
                (old) => {
                  if (!old) return old;
                  const updatedConversations = old.conversations.map((conv) =>
                    conv.id === wsMessage.conversation_id
                      ? { ...conv, unread_count: 0 }
                      : conv
                  );

                  // Actualizar contador global
                  emitUnreadConversationsCount(updatedConversations);

                  return {
                    ...old,
                    conversations: updatedConversations,
                  };
                }
              );
            }
          }
        }
        break;

      case 'status':
        if (wsMessage.user_id) {
          setOnlineUsers((prev) => {
            if (wsMessage.status === 'online') {
              return prev.includes(wsMessage.user_id) ? prev : [...prev, wsMessage.user_id];
            }
            return prev.filter((id) => id !== wsMessage.user_id);
          });
        }
        break;

      case 'typing':
        setIsTyping(wsMessage.is_typing || false);
        break;

      case 'online_users':
        setOnlineUsers(wsMessage.users || []);
        break;

      case 'error':
        console.error('WebSocket error:', wsMessage.message);
        break;

      case 'conversation_type_changed':
        if (wsMessage.conversation_id && wsMessage.conversation_type) {
          const newType = wsMessage.conversation_type as ConversationType;

          // Actualizar directamente el valor en el caché de la conversación específica
          queryClient.setQueryData<ConversationWithMessagesResponse>(
            chatKeys.conversation(wsMessage.conversation_id),
            (old) => old ? { ...old, conversation_type: newType } : old
          );

          // Actualizar también el listado
          queryClient.setQueriesData<PaginatedConversationsResponse>(
            { queryKey: chatKeys.conversations() },
            (old) => {
              if (!old) return old;
              return {
                ...old,
                conversations: old.conversations.map((c) =>
                  c.id === wsMessage.conversation_id ? { ...c, conversation_type: newType } : c
                ),
              };
            }
          );

          // E invalidar para que se recargue en fondo
          queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
          queryClient.invalidateQueries({ queryKey: chatKeys.conversation(wsMessage.conversation_id) });
        }
        break;

      default:
        console.log('Unknown message type:', wsMessage.type);
    }
  }, [selectedConversationId, user?.id, addMessageToCache, queryClient, accessToken, emitUnreadConversationsCount]);

  const { sendMessage: sendWebSocketMessage, sendTyping, isConnected, waitForConnection } = useChatWebSocket(
    selectedConversationId,
    user?.id || '',
    accessToken || '',
    handleWebSocketMessage
  );

  const otherUserId = selectedConversation
    ? (selectedConversation.user_id === user?.id
      ? selectedConversation.driver_id
      : selectedConversation.user_id)
    : null;

  const isOtherUserOnline = otherUserId
    ? onlineUsers.includes(otherUserId)
    : false;

  // Obtener perfil del otro usuario con caché (solo cuando el popup está abierto)
  const { data: otherUserProfileData, isLoading: isLoadingOtherProfile } = useUserProfile(
    otherUserId,
    isUserProfilePopupOpen && !!otherUserId && !!accessToken
  );

  // Convertir perfil a User con datos de la conversación como fallback
  const otherUserProfile: User | null = useMemo(() => {
    if (!selectedConversation || !otherUserId) return null;

    if (otherUserProfileData) {
      // Usar datos del backend si están disponibles
      return convertProfileToUser(
        otherUserProfileData,
        selectedConversation.other_user_name,
        selectedConversation.other_user_avatar
      );
    }

    // Fallback: usar datos básicos de la conversación
    return {
      id: otherUserId,
      full_name: selectedConversation.other_user_name,
      email: '',
      avatar: selectedConversation.other_user_avatar || undefined,
      rating: 5.0,
      tripsCompleted: 0,
      is_driver: selectedConversation.driver_id === otherUserId,
      user_role: 'user' as const,
      total_trips_as_driver: undefined,
      total_trips_as_passenger: undefined,
    };
  }, [otherUserProfileData, selectedConversation, otherUserId]);

  // ✅ React Query maneja el caché automáticamente
  // No necesitamos loadConversations manualmente - se carga automáticamente

  // Cargar más conversaciones (paginación)
  const loadMoreConversations = useCallback(() => {
    if (hasMoreConversations && !isLoadingConversations) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasMoreConversations, isLoadingConversations]);

  // Cargar conversación específica
  const loadConversation = useCallback(async (conversationId: string) => {
    setSelectedConversationId(conversationId);

    // Sincronizar conversation_type desde el listado al caché específico antes del refetch,
    // así el usuario ve el estado correcto inmediatamente sin esperar la red.
    const listPages = queryClient.getQueriesData<PaginatedConversationsResponse>(
      { queryKey: chatKeys.conversations() }
    );
    for (const [, page] of listPages) {
      if (!page) continue;
      const found = page.conversations.find((c) => c.id === conversationId);
      if (found?.conversation_type) {
        queryClient.setQueryData<ConversationWithMessagesResponse>(
          chatKeys.conversation(conversationId),
          (old) => old ? { ...old, conversation_type: found.conversation_type } : old
        );
        break;
      }
    }

    // ✅ Marcar mensajes como leídos en BD
    if (accessToken) {
      try {
        await markConversationAsRead(conversationId, accessToken);
        setPersistedUnreadCount(conversationId, 0);

        // ✅ Actualizar caché inmediatamente para que el contador desaparezca al instante
        queryClient.setQueriesData<PaginatedConversationsResponse>(
          { queryKey: chatKeys.conversations() },
          (old) => {
            if (!old) return old;
            const updatedConversations = old.conversations.map((conv) =>
              conv.id === conversationId
                ? { ...conv, unread_count: 0 }
                : conv
            );

            // Actualizar contador global
            emitUnreadConversationsCount(updatedConversations);

            return {
              ...old,
              conversations: updatedConversations,
            };
          }
        );

        // Invalidar caché para sincronizar con el servidor (en segundo plano)
        queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
      } catch (error) {
        console.error('Error marcando conversación como leída:', error);
      }
    }

    // Scroll al final después de cargar
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 100);
  }, [setPersistedUnreadCount, accessToken, queryClient, emitUnreadConversationsCount]);

  // ✅ Verificar si hay una conversación seleccionada desde el estado de navegación
  useEffect(() => {
    const state = location.state as { selectedConversationId?: string } | null;
    if (state?.selectedConversationId && !selectedConversationId) {
      loadConversation(state.selectedConversationId);
    }
  }, [location.state, selectedConversationId, loadConversation]);

  // Resetear página cuando cambia el filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [conversationTypeFilter]);

  // Actualizar hasMoreMessages cuando cambian los mensajes
  useEffect(() => {
    if (selectedConversation?.messages) {
      setHasMoreMessages(selectedConversation.messages.length >= 20);
    }
  }, [selectedConversation]);

  // Cargar mensajes antiguos (scroll infinito)
  const loadOlderMessages = useCallback(async () => {
    if (!accessToken || !selectedConversationId || isLoadingOlderMessages || !hasMoreMessages || !selectedConversation) {
      return;
    }

    try {
      setIsLoadingOlderMessages(true);

      // Obtener el mensaje más antiguo actual (de selectedConversation, no de messages derivado)
      const currentMessages = selectedConversation.messages || [];
      const sortedMessages = [...currentMessages].sort((a, b) => {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      const oldestMessage = sortedMessages[0];
      if (!oldestMessage) return;

      // Cargar mensajes anteriores
      const response = await getMessagesPage(
        selectedConversationId!,
        accessToken,
        oldestMessage.created_at
      );

      if (response.messages && response.messages.length > 0) {
        // Preservar la posición de scroll
        const container = messagesContainerRef.current;
        const previousScrollHeight = container?.scrollHeight || 0;
        const previousScrollTop = container?.scrollTop || 0;

        // Actualizar caché de React Query con los nuevos mensajes
        queryClient.setQueryData<ConversationWithMessagesResponse>(
          chatKeys.conversation(selectedConversationId),
          (old) => {
            if (!old) return old;

            // Combinar mensajes nuevos con existentes
            const combined = [...response.messages, ...old.messages];
            // Eliminar duplicados por ID
            const unique = combined.filter((msg, index, self) =>
              index === self.findIndex(m => m.id === msg.id)
            );
            // Ordenar por fecha
            const sorted = unique.sort((a, b) => {
              return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            });

            return {
              ...old,
              messages: sorted,
            };
          }
        );

        // Restaurar posición de scroll después de renderizar
        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            const scrollDiff = newScrollHeight - previousScrollHeight;
            container.scrollTop = previousScrollTop + scrollDiff;
          }
        }, 50);
      }

      setHasMoreMessages(response.has_more);
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }, [accessToken, selectedConversationId, isLoadingOlderMessages, hasMoreMessages, selectedConversation, queryClient]);

  // Detectar scroll hacia arriba para cargar mensajes antiguos
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !selectedConversationId) return;

    const handleScroll = () => {
      // Si está cerca del top (50px), cargar más mensajes
      if (container.scrollTop < 50 && hasMoreMessages && !isLoadingOlderMessages) {
        loadOlderMessages();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [selectedConversationId, hasMoreMessages, isLoadingOlderMessages, loadOlderMessages]);

  // Enviar mensaje (WebSocket-only)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || !accessToken) return;
    if (!selectedConversationId) return;

    // ✅ Si no hay conversación seleccionada, no se puede enviar
    // (el WebSocket solo se conecta cuando hay una conversación)
    if (!selectedConversationId) {
      console.warn('[Messages] No hay conversación seleccionada');
      return;
    }

    // ✅ Si hay conversación pero WebSocket no conectado, esperar
    if (selectedConversationId && !isConnected) {
      console.warn('[Messages] WebSocket no conectado, esperando conexión...');
      // Intentar esperar un poco más
      const connected = await waitForConnection(2000);
      if (!connected) {
        console.error('[Messages] WebSocket no disponible después de esperar');
        return;
      }
    }

    try {
      const conversationId = selectedConversationId;

      if (!conversationId) {
        console.error('[Messages] No hay conversación disponible');
        return;
      }

      // ✅ Si hay conversación pero WebSocket no conectado, esperar un poco más
      if (!isConnected) {
        console.log('[Messages] WebSocket no conectado, esperando...');
        const connected = await waitForConnection(2000);
        if (!connected) {
          console.error('[Messages] WebSocket no disponible');
          setNewMessage(newMessage.trim());
          return;
        }
      }

      const messageContent = newMessage.trim();
      setNewMessage('');

      // ✅ Crear mensaje temporal con estado "sending"
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const tempMessage: MessageResponse = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: user?.id || '',
        sender_name: user?.full_name,
        content: messageContent,
        created_at: new Date().toISOString(),
        status: 'sending',
        tempId: tempId,
      };

      // ✅ Agregar mensaje temporal al caché
      queryClient.setQueryData<ConversationWithMessagesResponse>(
        chatKeys.conversation(conversationId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            messages: [...old.messages, tempMessage],
            last_message_content: messageContent,
            last_message_at: tempMessage.created_at,
          };
        }
      );

      // ✅ Enviar por WebSocket (único método)
      try {
        sendWebSocketMessage(messageContent);

        // ✅ Timeout: si no hay confirmación en 10 segundos, marcar como fallido
        const timeoutId = setTimeout(() => {
          queryClient.setQueryData<ConversationWithMessagesResponse>(
            chatKeys.conversation(conversationId),
            (old) => {
              if (!old) return old;
              return {
                ...old,
                messages: old.messages.map((m) =>
                  m.tempId === tempId ? { ...m, status: 'failed' as const } : m
                ),
              };
            }
          );
        }, 10000); // 10 segundos

        // Guardar timeout para limpiarlo si llega confirmación
        (tempMessage as any).timeoutId = timeoutId;

        // ✅ Scroll al final después de enviar
        setTimeout(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          }
        }, 100);
      } catch (error) {
        console.error('Error sending message via WebSocket:', error);
        // Marcar como fallido inmediatamente
        queryClient.setQueryData<ConversationWithMessagesResponse>(
          chatKeys.conversation(conversationId),
          (old) => {
            if (!old) return old;
            return {
              ...old,
              messages: old.messages.map((m) =>
                m.tempId === tempId ? { ...m, status: 'failed' as const } : m
              ),
            };
          }
        );
        // Restaurar mensaje si falla
        setNewMessage(messageContent);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(newMessage.trim()); // Restaurar mensaje
    }
  };

  // Manejar escritura (typing indicator)
  const handleInputChange = (value: string) => {
    setNewMessage(value);

    if (isConnected) {
      const hasContent = value.length > 0;

      // Limpiar timeout anterior
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        setTypingTimeout(null);
      }

      if (hasContent) {
        // Si hay contenido y NO estábamos escribiendo, enviar "true" (empezó a escribir)
        if (!isCurrentlyTyping) {
          sendTyping(true);
          setIsCurrentlyTyping(true);
        }
        // Si ya estábamos escribiendo, no enviar otro "true" (evitar spam)

        // Detener indicador después de 3 segundos de inactividad
        const timeout = setTimeout(() => {
          sendTyping(false);
          setIsCurrentlyTyping(false);
        }, 3000);

        setTypingTimeout(timeout);
      } else {
        // Si borró todo el texto, detener inmediatamente
        if (isCurrentlyTyping) {
          sendTyping(false);
          setIsCurrentlyTyping(false);
        }
      }
    }
  };

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [typingTimeout]);

  // Detener indicador cuando se desconecta el WebSocket
  useEffect(() => {
    if (!isConnected && isCurrentlyTyping) {
      setIsCurrentlyTyping(false);
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        setTypingTimeout(null);
      }
      // Enviar false al servidor si estábamos escribiendo
      sendTyping(false);
    }
  }, [isConnected, isCurrentlyTyping, typingTimeout, sendTyping]);

  // ✅ React Query carga automáticamente - no necesitamos useEffect
  // Los datos se cachean y persisten entre navegaciones

  // ✅ Verificar si hay una conversación seleccionada desde el estado de navegación
  useEffect(() => {
    const locationState = window.history.state?.usr;
    if (locationState?.selectedConversationId) {
      loadConversation(locationState.selectedConversationId);
      // Limpiar el estado después de usarlo
      window.history.replaceState({ ...window.history.state, usr: {} }, '');
    }
  }, []);

  // Debug: mostrar estado de conexión
  useEffect(() => {
    console.log('WebSocket connected:', isConnected);
  }, [isConnected]);

  // Escuchar notificaciones globales para ajustar contadores si estás viendo la conversación
  // (GlobalNotificationsListener ya actualiza el caché, aquí solo ajustamos si es necesario)
  useEffect(() => {
    const handler = (ev: Event) => {
      // @ts-ignore
      const payload = ev?.detail;
      if (!payload) return;
      if (payload.type === 'new_message') {
        const convId = payload.conversation_id;

        // Si estás viendo esta conversación, el contador debe ser 0
        if (selectedConversationId === convId) {
          queryClient.setQueriesData<PaginatedConversationsResponse>(
            { queryKey: chatKeys.conversations() },
            (old) => {
              if (!old) return old;
              const updated = old.conversations.map((conv) =>
                conv.id === convId ? { ...conv, unread_count: 0 } : conv
              );
              emitUnreadConversationsCount(updated);
              return { ...old, conversations: updated };
            }
          );
        }
      }
    };

    window.addEventListener('app:notification', handler as EventListener);
    return () => {
      window.removeEventListener('app:notification', handler as EventListener);
    };
  }, [selectedConversationId, queryClient, emitUnreadConversationsCount]);

  const getDateLabel = (isoDate: string) => {
    const date = new Date(isoDate);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoy';
    }

    if (date.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    }

    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Si hay conversación seleccionada, mostrar chat
  if (selectedConversation) {
    const chatName = selectedConversation?.other_user_name || 'Usuario';
    const chatType = selectedConversation?.conversation_type || 'pre';

    const getConversationTypeLabel = (type?: ConversationType) => {
      if (type === 'cancelled') return 'Cancelada';
      if (type === 'rejected') return 'Solicitud rechazada';
      if (type === 'post') return 'Viaje confirmado';

      // Si el tipo es 'pre', verificar si hay una reserva activa
      return selectedConversation?.has_active_reservation
        ? 'Solicitud previa'
        : 'Consulta previa';
    };

    // Función para obtener el color del tipo de conversación
    const getConversationTypeColor = (type?: ConversationType) => {
      if (type === 'cancelled') return 'text-red-600 dark:text-red-400';
      if (type === 'rejected') return 'text-orange-600 dark:text-orange-400';
      if (type === 'post') return 'text-green-600 dark:text-green-400';

      // Si el tipo es 'pre', usar ámbar si hay reserva, o gris si es consulta previa
      return selectedConversation?.has_active_reservation
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground'; // Color gris
    };

    const isConversationClosed = false;

    return (
      <div className="h-[calc(100dvh-4rem)] flex flex-col bg-background">
        {/* Chat Header */}
        <div className="flex items-center gap-3 px-4 py-4 bg-card shadow-sm safe-area-top">
          <button
            onClick={() => {
              setSelectedConversationId(null);
              // Limpiar el estado de navegación para evitar que se vuelva a cargar la conversación
              navigate('/messages', { replace: true, state: {} });
            }}
            className="p-2 -ml-2 hover:bg-accent rounded-xl transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <UserProfilePopup
            user={otherUserProfile}
            open={isUserProfilePopupOpen}
            onOpenChange={setIsUserProfilePopupOpen}
            side="bottom"
            align="start"
            trigger={
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setIsUserProfilePopupOpen(true);
                }}
                className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center">
                  {selectedConversation.other_user_avatar ? (
                    <img
                      src={selectedConversation.other_user_avatar}
                      alt={chatName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-primary font-semibold text-sm">
                      {chatName.split(' ').map(n => n[0]).join('')}
                    </span>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-foreground">{chatName}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={(e) => {
                        if (selectedConversation.trip_id) {
                          e.stopPropagation();
                          const isDriver = user?.id === selectedConversation.driver_id?.toString();
                          navigate(isDriver
                            ? `/my-trips/manage/${selectedConversation.trip_id}`
                            : `/trip-details/${selectedConversation.trip_id}`
                          );
                        }
                      }}
                      className={`text-xs font-medium ${getConversationTypeColor(chatType)} ${selectedConversation.trip_id ? 'hover:underline cursor-pointer' : 'cursor-default'}`}
                    >
                      {getConversationTypeLabel(chatType)}
                    </button>

                    {isOtherUserOnline && (
                      <>
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-xs text-muted-foreground">
                          En línea
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            }
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetchSelectedConversation()}
            disabled={isLoadingMessages}
            className="rounded-full hover:bg-accent transition-colors flex-shrink-0"
          >
            <RefreshCw className={`w-5 h-5 text-foreground ${isLoadingMessages ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {selectedConversation.pending_reservation &&
          user?.id === selectedConversation.driver_id?.toString() &&
          selectedConversation.pending_reservation.status === 'pending' && (
            <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2 bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-200 truncate">
                ¿Aceptar solicitud de{' '}
                <span className="font-bold">{selectedConversation.pending_reservation.passenger_name}</span>?
              </p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <PendingReservationActions
                  conversationId={selectedConversation.id}
                  reservation={selectedConversation.pending_reservation}
                  accessToken={accessToken}
                  onActionComplete={() => refetchSelectedConversation()}
                />
              </div>
            </div>
          )}

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3 flex flex-col justify-center"
        >
          {/* Indicador de carga de mensajes antiguos */}
          {isLoadingOlderMessages && (
            <div className="flex justify-center py-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {isLoadingMessages ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center">
              <MessageCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay mensajes aún</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isMe = message.sender_id === user?.id;
              const currentDateLabel = getDateLabel(message.created_at);
              const previousMessage = messages[index - 1];
              const previousDateLabel = previousMessage
                ? getDateLabel(previousMessage.created_at)
                : null;
              const showDateSeparator = !previousMessage || currentDateLabel !== previousDateLabel;

              return (
                <React.Fragment key={message.id}>
                  {showDateSeparator && (
                    <div className="flex items-center gap-3 my-2">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap capitalize">
                        {currentDateLabel}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                    <div
                      className={`max-w-[75%] px-4 py-3 rounded-2xl ${isMe
                        ? message.status === 'failed'
                          ? 'bg-destructive/20 text-destructive border border-destructive/30'
                          : 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-secondary text-secondary-foreground rounded-bl-md'
                        }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className={`text-xs ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {new Date(message.created_at).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {isMe && message.status === 'sending' && (
                          <Loader2 className="w-3 h-3 animate-spin text-primary-foreground/70" />
                        )}
                        {isMe && message.status === 'failed' && (
                          <span className="text-xs text-destructive">Error</span>
                        )}
                      </div>
                    </div>
                    {isMe && message.status === 'failed' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => {
                          // Reenviar mensaje
                          if (selectedConversationId && isConnected) {
                            const messageContent = message.content;
                            // Eliminar mensaje fallido
                            queryClient.setQueryData<ConversationWithMessagesResponse>(
                              chatKeys.conversation(selectedConversationId),
                              (old) => {
                                if (!old) return old;
                                return {
                                  ...old,
                                  messages: old.messages.filter(m => m.id !== message.id),
                                };
                              }
                            );
                            // Crear nuevo mensaje temporal y enviar
                            const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                            const tempMessage: MessageResponse = {
                              id: tempId,
                              conversation_id: selectedConversationId,
                              sender_id: user?.id || '',
                              sender_name: user?.full_name,
                              content: messageContent,
                              created_at: new Date().toISOString(),
                              status: 'sending',
                              tempId: tempId,
                            };
                            queryClient.setQueryData<ConversationWithMessagesResponse>(
                              chatKeys.conversation(selectedConversationId),
                              (old) => {
                                if (!old) return old;
                                return {
                                  ...old,
                                  messages: [...old.messages, tempMessage],
                                };
                              }
                            );
                            // Enviar por WebSocket
                            sendWebSocketMessage(messageContent);
                            // Timeout
                            const timeoutId = setTimeout(() => {
                              queryClient.setQueryData<ConversationWithMessagesResponse>(
                                chatKeys.conversation(selectedConversationId),
                                (old) => {
                                  if (!old) return old;
                                  return {
                                    ...old,
                                    messages: old.messages.map((m) =>
                                      m.tempId === tempId ? { ...m, status: 'failed' as const } : m
                                    ),
                                  };
                                }
                              );
                            }, 10000);
                            (tempMessage as any).timeoutId = timeoutId;
                          }
                        }}
                        title="Reenviar mensaje"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </React.Fragment>
              );
            })
          )}

          {/* Indicador de escritura */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-secondary text-secondary-foreground px-4 py-3 rounded-2xl rounded-bl-md max-w-[75%]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-muted-foreground">Escribiendo...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Message Input - ocultar o deshabilitar si la conversación está cancelada */}
        <form onSubmit={handleSendMessage} className="p-4 bg-card border-t border-border safe-area-bottom">
          {isConversationClosed && (
            <p className={`text-sm mb-3 text-center ${chatType === 'rejected' ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400'}`}>
              {chatType === 'rejected'
                ? 'Esta solicitud fue rechazada. No puedes enviar más mensajes.'
                : 'Esta reserva fue cancelada. No puedes enviar más mensajes.'}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder={
                isConversationClosed
                  ? chatType === 'rejected' ? 'Solicitud rechazada' : 'Reserva cancelada'
                  : !isConnected
                    ? "Conectando WebSocket..."
                    : "Escribe un mensaje..."
              }
              value={newMessage}
              onChange={(e) => handleInputChange(e.target.value)}
              className="flex-1"
              disabled={isSendingMessage || !isConnected || isConversationClosed}
            />
            <Button
              type="submit"
              size="icon"
              className="rounded-full w-12 h-12"
              disabled={!newMessage.trim() || isSendingMessage || !isConnected || isConversationClosed}
              title={
                isConversationClosed
                  ? chatType === 'rejected' ? 'Solicitud rechazada' : 'Reserva cancelada'
                  : !isConnected
                    ? "Esperando conexión WebSocket..."
                    : "Enviar mensaje"
              }
            >
              {isSendingMessage ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : !isConnected ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // Vista de lista de conversaciones
  return (
    <div className="min-h-screen bg-background px-4 py-6">
      {/* Header */}
      <div className="mb-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Mensajes</h1>
            <p className="text-muted-foreground mt-1">Tus conversaciones</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetchConversations()}
            disabled={isLoadingConversations}
            className="flex-shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingConversations ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Filtro de tipo de conversación */}
        <div className="flex gap-2 mt-4">
          <Button
            variant={conversationTypeFilter === undefined ? "default" : "outline"}
            size="sm"
            onClick={() => setConversationTypeFilter(undefined)}
            className="text-xs"
          >
            Todas
          </Button>
          <Button
            variant={conversationTypeFilter === 'pre' ? "default" : "outline"}
            size="sm"
            onClick={() => setConversationTypeFilter('pre')}
            className="text-xs"
          >
            Solicitud previa
          </Button>
          <Button
            variant={conversationTypeFilter === 'post' ? "default" : "outline"}
            size="sm"
            onClick={() => setConversationTypeFilter('post')}
            className="text-xs"
          >
            Viaje confirmado
          </Button>
        </div>
      </div>

      {/* Conversations List */}
      {isLoadingConversations ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
          <div className="w-20 h-20 bg-primary-light rounded-full flex items-center justify-center mb-4">
            <MessageCircle className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-lg font-display font-semibold text-foreground mb-2">
            Sin mensajes
          </h3>
          <p className="text-muted-foreground text-center max-w-xs">
            Cuando contactes a un conductor desde un viaje, aparecerá aquí
          </p>
        </div>
      ) : (
        <div className="space-y-2 animate-slide-up">
          {conversations.map((conversation) => (
            <ConversationListItem
              key={conversation.id}
              conversation={conversation}
              onSelect={() => loadConversation(conversation.id)}
              popupConversationId={popupConversationId}
              setPopupConversationId={setPopupConversationId}
              accessToken={accessToken}
            />
          ))}

          {/* Botón "Cargar más" */}
          {hasMoreConversations && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={loadMoreConversations}
                disabled={isLoadingConversations}
                variant="outline"
                className="w-full max-w-xs"
              >
                {isLoadingConversations ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Cargando...
                  </>
                ) : (
                  'Cargar más conversaciones'
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Messages;