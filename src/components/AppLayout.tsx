import React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNavigation } from './BottomNavigation';
import { ActiveTripBanner } from './ActiveTripBanner';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ActiveTripBanner />
      <main className="flex-1 pb-20 safe-area-top">
        <Outlet />
      </main>
      <BottomNavigation />
    </div>
  );
};
