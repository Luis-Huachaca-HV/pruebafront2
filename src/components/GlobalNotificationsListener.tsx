/**
 * Componente global que escucha notificaciones y actualiza el caché de conversaciones
 * incluso cuando Messages.tsx no está montado (p.ej. en otras pestañas).
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { chatKeys } from '@/hooks/use-chat-cache';
import type { ConversationType, ConversationWithMessagesResponse, PaginatedConversationsResponse } from '@/services/chat';
import { useToast } from '@/hooks/use-toast';

export const GlobalNotificationsListener: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const handler = (ev: Event) => {
      // @ts-ignore
      const payload = ev?.detail;
      if (!payload) return;

      // Nueva reserva confirmada en uno de mis viajes (notificación para conductores)
      if (payload.type === 'reservation_confirmed') {
        const { passenger_name, seat_count, origin_name, destination_name } = payload;
        const seats = seat_count > 1 ? `${seat_count} asientos` : `${seat_count} asiento`;
        toast({
          title: '¡Nueva reserva en tu viaje! 🚗',
          description: `${passenger_name || 'Un pasajero'} reservó ${seats}${origin_name && destination_name ? ` en ${origin_name} → ${destination_name}` : ''}.`,
        });
        return;
      }

      // Manejar cambio de tipo de conversación
      if (payload.type === 'conversation_type_changed') {
        const convId = payload.conversation_id as string;
        const newType = payload.conversation_type as ConversationType;
        if (!convId || !newType) return;

        // Actualizar DIRECTAMENTE el valor en el caché de la conversación específica
        // (no solo invalidar, para evitar que se muestre el valor viejo mientras recarga)
        queryClient.setQueryData<ConversationWithMessagesResponse>(
          chatKeys.conversation(convId),
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
                c.id === convId ? { ...c, conversation_type: newType } : c
              ),
            };
          }
        );

        // Invalidar para que el fondo recargue los datos completos del servidor
        queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
        queryClient.invalidateQueries({ queryKey: chatKeys.conversation(convId) });
        return;
      }

      // Manejar nuevo mensaje
      if (payload.type !== 'new_message') return;

      const convId = payload.conversation_id;
      const message = payload.message;

      if (!convId || !message) return;

      // Actualizar TODAS las páginas de conversaciones en caché
      queryClient.setQueriesData<PaginatedConversationsResponse>(
        { queryKey: chatKeys.conversations() },
        (old) => {
          if (!old) return old;
          
          const updated = old.conversations.map((conv) => {
            if (conv.id === convId) {
              const newCount = (conv.unread_count || 0) + 1;
              return {
                ...conv,
                last_message_content: message?.content || conv.last_message_content,
                last_message_at: message?.created_at || conv.last_message_at,
                unread_count: newCount,
              };
            }
            return conv;
          });

          const totalUnread = updated.filter(c => c.unread_count > 0).length;
          try {
            window.dispatchEvent(new CustomEvent('app:unread-conversations-count', { 
              detail: { count: totalUnread } 
            }));
          } catch (e) {
            console.warn('Could not dispatch unread count event', e);
          }

          return { ...old, conversations: updated };
        }
      );
    };

    window.addEventListener('app:notification', handler as EventListener);
    
    return () => {
      window.removeEventListener('app:notification', handler as EventListener);
    };
  }, [queryClient, toast]);

  return null;
};
