/**
 * Hooks para caché de conversaciones y mensajes usando React Query.
 * Evita recargar datos cuando navegas entre páginas.
 */
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  getConversations,
  getConversation,
  getMessagesPage,
  sendMessage as sendMessageAPI,
  createConversation as createConversationAPI,
  PaginatedConversationsResponse,
  ConversationWithMessagesResponse,
  PaginatedMessagesResponse,
  ConversationListItem,
  MessageResponse,
  ConversationCreate,
} from '@/services/chat';
import { useAuth } from '@/contexts/AuthContext';

// Query keys para React Query
export const chatKeys = {
  all: ['chat'] as const,
  conversations: () => [...chatKeys.all, 'conversations'] as const,
  conversationsList: (page?: number, conversationType?: 'pre' | 'post') => 
    [...chatKeys.conversations(), page, conversationType] as const,
  conversation: (id: string) => [...chatKeys.all, 'conversation', id] as const,
  messages: (conversationId: string, offsetDate?: string) =>
    [...chatKeys.all, 'messages', conversationId, offsetDate] as const,
};

/**
 * Hook para obtener conversaciones con caché.
 * 
 * ⚠️ TEMPORALMENTE: Caché desactivado - siempre refetchea al montar
 */
export const useConversations = (page = 1, conversationType?: 'pre' | 'post') => {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: chatKeys.conversationsList(page, conversationType),
    queryFn: () => getConversations(accessToken!, page, conversationType),
    enabled: !!accessToken,
    staleTime: 0, // ⚠️ TEMPORAL: Siempre considerar datos obsoletos
    gcTime: 10 * 60 * 1000, // 10 minutos - tiempo en caché antes de ser eliminados
    refetchOnWindowFocus: false, // No recargar al cambiar de tab
    refetchOnMount: true, // ⚠️ TEMPORAL: Siempre recargar al montar
  });
};

/**
 * Hook para obtener una conversación con sus mensajes.
 * 
 * ⚠️ TEMPORALMENTE: Caché desactivado - siempre refetchea al montar
 */
export const useConversation = (conversationId: string | null, limit = 20) => {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: chatKeys.conversation(conversationId || ''),
    queryFn: () => getConversation(conversationId!, accessToken!),
    enabled: !!accessToken && !!conversationId,
    staleTime: 0, // ⚠️ TEMPORAL: Siempre considerar datos obsoletos
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true, // ⚠️ TEMPORAL: Siempre recargar al montar
  });
};

/**
 * Hook para obtener mensajes paginados de una conversación.
 */
export const useMessages = (conversationId: string | null, offsetDate?: string) => {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: chatKeys.messages(conversationId || '', offsetDate),
    queryFn: () => getMessagesPage(conversationId!, accessToken!, offsetDate),
    enabled: !!accessToken && !!conversationId,
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};

/**
 * Hook para crear una conversación y actualizar el caché.
 */
export const useCreateConversation = () => {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ConversationCreate) => createConversationAPI(data, accessToken!),
    onSuccess: () => {
      // Invalidar caché de conversaciones para que se recargue la lista
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
};

/**
 * Hook para enviar un mensaje y actualizar el caché.
 */
export const useSendMessage = () => {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, content }: { conversationId: string; content: string }) =>
      sendMessageAPI(conversationId, content, accessToken!),
    onSuccess: (data, variables) => {
      // Actualizar caché de la conversación
      queryClient.setQueryData<ConversationWithMessagesResponse>(
        chatKeys.conversation(variables.conversationId),
        (old) => {
          if (!old) return old;
          
          // ✅ Evitar duplicados: verificar si el mensaje ya existe
          const exists = old.messages.some((m) => {
            if (m.id && data.id && m.id === data.id) return true;
            // También verificar por contenido + sender_id + timestamp similar (menos de 2 segundos)
            if (m.content === data.content && 
                m.sender_id === data.sender_id &&
                Math.abs(new Date(m.created_at).getTime() - new Date(data.created_at).getTime()) < 2000) {
              return true;
            }
            return false;
          });
          
          if (exists) {
            console.log('[useSendMessage] Mensaje duplicado detectado, no agregando:', data.id);
            return old;
          }
          
          return {
            ...old,
            messages: [...old.messages, data],
            last_message_content: data.content,
            last_message_at: data.created_at,
          };
        }
      );

      // Actualizar lista de conversaciones
      queryClient.setQueryData<PaginatedConversationsResponse>(
        chatKeys.conversationsList(),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            conversations: old.conversations.map((conv) =>
              conv.id === variables.conversationId
                ? {
                    ...conv,
                    last_message_content: data.content,
                    last_message_at: data.created_at,
                  }
                : conv
            ),
          };
        }
      );
    },
  });
};

/**
 * Utilidad para actualizar una conversación en el caché cuando llega un mensaje por WebSocket.
 */
export const useUpdateConversationCache = () => {
  const queryClient = useQueryClient();

  const addMessageToCache = (conversationId: string, message: MessageResponse) => {
    // Actualizar conversación
    queryClient.setQueryData<ConversationWithMessagesResponse>(
      chatKeys.conversation(conversationId),
      (old) => {
        if (!old) return old;
        // Evitar duplicados: verificar por ID o por contenido + sender_id + timestamp similar
        const exists = old.messages.some((m) => {
          if (m.id && message.id && m.id === message.id) return true;
          // También evitar duplicados por contenido si es muy reciente (menos de 2 segundos)
          if (m.content === message.content && 
              m.sender_id === message.sender_id &&
              Math.abs(new Date(m.created_at).getTime() - new Date(message.created_at).getTime()) < 2000) {
            return true;
          }
          return false;
        });
        if (exists) return old;
        return {
          ...old,
          messages: [...old.messages, message],
          last_message_content: message.content,
          last_message_at: message.created_at,
        };
      }
    );

    // Actualizar lista de conversaciones
    queryClient.setQueriesData<PaginatedConversationsResponse>(
      { queryKey: chatKeys.conversations() },
      (old) => {
        if (!old) return old;
        return {
          ...old,
          conversations: old.conversations.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  last_message_content: message.content,
                  last_message_at: message.created_at,
                  unread_count:
                    message.sender_id !== old.conversations.find((c) => c.id === conversationId)?.other_user_id
                      ? (conv.unread_count || 0) + 1
                      : conv.unread_count,
                }
              : conv
          ),
        };
      }
    );
  };

  return { addMessageToCache };
};
