import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Car, MessageCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { path: '/search', label: 'Buscar', icon: Search },
  { path: '/my-trips', label: 'Mis Viajes', icon: Car },
  { path: '/messages', label: 'Mensajes', icon: MessageCircle },
  { path: '/profile', label: 'Perfil', icon: User },
];

export const BottomNavigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { unreadConversationsCount } = useAuth();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-nav shadow-nav safe-area-bottom z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          const showBadge = item.path === '/messages' && unreadConversationsCount > 0;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full transition-all duration-200",
                isActive ? "text-nav-active" : "text-nav-inactive"
              )}
            >
              <div className={cn(
                "relative p-2 rounded-xl transition-all duration-200",
                isActive && "bg-primary-light"
              )}>
                <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
                {showBadge && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadConversationsCount}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-xs mt-0.5 font-medium",
                isActive && "font-semibold"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
