import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MiniPlayer } from "@/components/MiniPlayer";
import { PlayerView } from "@/components/PlayerView"; // Import PlayerView
import { QueueDrawer } from "@/components/QueueDrawer"; // Import QueueDrawer
import { useAuth } from "@/contexts/AuthContext";
import { usePlayerStore } from "@/store/playerStore"; // Import player store
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import PublicHome from "./pages/PublicHome";
import NotFound from "./pages/NotFound";
import Subscriptions from "./pages/Subscriptions";
import React from "react";

const queryClient = new QueryClient();

const App = () => {
  // Ref for the YouTube iframe element, shared between MiniPlayer and PlayerView
  const youtubeIframeRef = React.useRef<HTMLDivElement>(null);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {/* Persistent MiniPlayer and QueueDrawer */}
          <MiniPlayer youtubeIframeRef={youtubeIframeRef} />
          <QueueDrawer />
          
          {/* PlayerView (full screen video player) - conditionally rendered */}
          <PlayerViewWrapper youtubeIframeRef={youtubeIframeRef} />

          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

// Wrapper component to conditionally render PlayerView based on player store state
function PlayerViewWrapper({ youtubeIframeRef }: { youtubeIframeRef: React.RefObject<HTMLDivElement> }) {
  const { current, isPlayerViewOpen } = usePlayerStore();
  const isVideoPlaying = current?.type === 'video';

  if (isPlayerViewOpen && isVideoPlaying) {
    return <PlayerView youtubeIframeRef={youtubeIframeRef} />;
  }
  return null;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/subscriptions" element={<ProtectedRoute><Subscriptions /></ProtectedRoute>} />
      <Route path="/" element={
        user ? (
          <ProtectedRoute>
            <Index />
          </ProtectedRoute>
        ) : (
          <PublicHome />
        )
      } />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;