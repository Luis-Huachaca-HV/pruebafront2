import React, { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/services/notifications';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const formatRelativeTime = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

// Campanita de notificaciones — refleja las notificaciones reales generadas por
// mocks/services/index.ts (p.ej. cuando un pasajero reserva un viaje).
export const NotificationBell: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    const [{ notifications }, count] = await Promise.all([
      getNotifications(),
      getUnreadNotificationsCount(),
    ]);
    setItems(notifications);
    setUnread(count);
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('app:notification', handler);
    return () => window.removeEventListener('app:notification', handler);
  }, [refresh]);

  if (!isAuthenticated) return null;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) refresh();
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    refresh();
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.is_read) {
      await markNotificationAsRead(item.id);
      refresh();
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#0F2A4D]/5 transition-colors"
          aria-label="Notificaciones"
        >
          <Bell className="w-5 h-5 text-[#0F2A4D]" />
          {unread > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#F97316] text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#DCE8F5]">
          <p className="font-black text-[#0F2A4D]">Notificaciones</p>
          {unread > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#F97316] hover:text-[#EA580C]"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Marcar todas
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Aún no tienes notificaciones.</p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item)}
                className={`w-full text-left px-4 py-3 border-b border-[#DCE8F5] last:border-0 hover:bg-[#0F2A4D]/5 transition-colors ${
                  item.is_read ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  {!item.is_read && <span className="mt-1.5 w-2 h-2 rounded-full bg-[#F97316] shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#0F2A4D] leading-tight">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-snug">{item.message}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{formatRelativeTime(item.created_at)}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
