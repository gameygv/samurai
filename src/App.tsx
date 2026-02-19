import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Index from "./pages/Index";
import AgentBrain from "./pages/AgentBrain";
import LearningLog from "./pages/LearningLog";
import KnowledgeBase from "./pages/KnowledgeBase";
import Activity from "./pages/Activity";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import UsersPage from "./pages/Users";
import Logs from "./pages/Logs";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Leads from "./pages/Leads";
import Archive from "./pages/Archive";
import MediaManager from "./pages/MediaManager";
import Manual from "./pages/Manual";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={<PrivateRoute><Index /></PrivateRoute>} />
            <Route path="/brain" element={<PrivateRoute><AgentBrain /></PrivateRoute>} />
            <Route path="/learning" element={<PrivateRoute><LearningLog /></PrivateRoute>} />
            <Route path="/knowledge" element={<PrivateRoute><KnowledgeBase /></PrivateRoute>} />
            <Route path="/media" element={<PrivateRoute><MediaManager /></PrivateRoute>} />
            <Route path="/activity" element={<PrivateRoute><Activity /></PrivateRoute>} />
            <Route path="/users" element={<PrivateRoute><UsersPage /></PrivateRoute>} />
            <Route path="/logs" element={<PrivateRoute><Logs /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
            <Route path="/leads" element={<PrivateRoute><Leads /></PrivateRoute>} />
            <Route path="/archive" element={<PrivateRoute><Archive /></PrivateRoute>} />
            <Route path="/manual" element={<PrivateRoute><Manual /></PrivateRoute>} /> 
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;