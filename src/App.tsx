//app.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { GlobalNotificationsListener } from "@/components/GlobalNotificationsListener";
import ProtectedRoute from '@/components/ProtectedRoute';
import PublicRoute from '@/components/PublicRoute';

import Index from "@/pages/Index";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import Search from "@/pages/Search";
import Itinerary from "@/pages/Itinerary";
import Payment from "@/pages/Payment";
import CheckoutPage from "@/pages/CheckoutPage";
import MyTrips from "@/pages/MyTrips";
import ManageTrip from "@/pages/ManageTrip";
import Messages from "@/pages/Messages";
import Profile from "@/pages/Profile";
import TripDetails from "@/pages/TripDetails";
import NotFound from "@/pages/NotFound";
import Wallet from "@/pages/Wallet";
import OAuthCallback from "@/pages/OAuthCallback";
import { DemoControls } from '@/components/DemoControls';


// Admin imports

/*
import {
  AdminLogin,
  AdminDashboard,
  AdminVehicles,
  AdminDrivers,
  AdminUsers
} from "@/pages/admin";

*/



const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});



const AppRoutes = () => {
  return (
    <Routes>

      {/* Landing */}
      <Route path="/" element={<Index />} />
      <Route path="/index" element={<Index />} />
      {/* PUBLIC ROUTES */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/auth/callback" element={<OAuthCallback />} />

      {/* MAIN APP */}

      <Route element={<AppLayout />}>

        {/* PUBLIC ROUTES */}
        <Route path="/search" element={<Search />} />
        <Route path="/itinerary" element={<Itinerary />} />
        <Route path="/trip-details/:id" element={<TripDetails />} />

        {/* PROTECTED ROUTES */}
        <Route path="/payment" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
        <Route path="/my-trips" element={<ProtectedRoute><MyTrips /></ProtectedRoute>} />
        <Route path="/my-trips/manage/:tripId" element={<ProtectedRoute><ManageTrip /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />

      </Route>

      <Route path="/trip/:id" element={<TripDetails />} />


      {/* ADMIN */}

      {/*
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/vehicles" element={<AdminVehicles />} />
        <Route path="/admin/drivers" element={<AdminDrivers />} />
        <Route path="/admin/users" element={<AdminUsers />} />
         */}

      {/* DEFAULT */}

      <Route path="*" element={<NotFound />} />

    </Routes>
  );
};



const App = () => (

  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <GlobalNotificationsListener />
      <DemoControls />
      <TooltipProvider>
        <Toaster />
        <Sonner />

        <AppRoutes />

      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>

);

export default App;
