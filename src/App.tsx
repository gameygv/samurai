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
import Contacts from "./pages/Contacts";
import Campaigns from "./pages/Campaigns";
import Archive from "./pages/Archive";
import MediaManager from "./pages/MediaManager";
import WebsiteContent from "./pages/WebsiteContent";
import MetaCapi from "./pages/MetaCapi";
import Pipeline from "./pages/Pipeline";
import PendingPayments from "./pages/PendingPayments";
import Inbox from "./pages/Inbox";
import WebhookDiag from "./pages/WebhookDiag";
import AgentTools from "./pages/AgentTools";
import AcademicCatalog from "./pages/AcademicCatalog";
import MetaVerify from "./pages/MetaVerify";
import ChannelsCatalog from "./pages/ChannelsCatalog";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    const { isAdmin, loading } = useAuth();
    if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-amber-600 animate-spin" /></div>;
    if (!isAdmin) return <Navigate to="/" replace />;
    return <>{children}</>;
};

const ManagerRoute = ({ children }: { children: React.ReactNode }) => {
    const { isManager, loading } = useAuth();
    if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-amber-600 animate-spin" /></div>;
    if (!isManager) return <Navigate to="/" replace />;
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
            <Route path="/inbox" element={<PrivateRoute><Inbox /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
            
            <Route path="/leads" element={<PrivateRoute><Leads /></PrivateRoute>} />
            <Route path="/contacts" element={<PrivateRoute><Contacts /></PrivateRoute>} />
            <Route path="/campaigns" element={<PrivateRoute><Campaigns /></PrivateRoute>} />
            <Route path="/tools" element={<PrivateRoute><AgentTools /></PrivateRoute>} />
            <Route path="/pipeline" element={<PrivateRoute><Pipeline /></PrivateRoute>} />
            <Route path="/pending-payments" element={<PrivateRoute><PendingPayments /></PrivateRoute>} />
            <Route path="/archive" element={<PrivateRoute><Archive /></PrivateRoute>} />

            <Route path="/academic" element={<PrivateRoute><ManagerRoute><AcademicCatalog /></ManagerRoute></PrivateRoute>} />
            <Route path="/channels" element={<PrivateRoute><AdminRoute><ChannelsCatalog /></AdminRoute></PrivateRoute>} />
            
            <Route path="/activity" element={<PrivateRoute><AdminRoute><Activity /></AdminRoute></PrivateRoute>} />
            <Route path="/brain" element={<PrivateRoute><AdminRoute><AgentBrain /></AdminRoute></PrivateRoute>} />
            <Route path="/learning" element={<PrivateRoute><AdminRoute><LearningLog /></AdminRoute></PrivateRoute>} />
            <Route path="/knowledge" element={<PrivateRoute><AdminRoute><KnowledgeBase /></AdminRoute></PrivateRoute>} />
            <Route path="/media" element={<PrivateRoute><AdminRoute><MediaManager /></AdminRoute></PrivateRoute>} />
            <Route path="/website-content" element={<PrivateRoute><AdminRoute><WebsiteContent /></AdminRoute></PrivateRoute>} />
            <Route path="/users" element={<PrivateRoute><AdminRoute><UsersPage /></AdminRoute></PrivateRoute>} />
            <Route path="/logs" element={<PrivateRoute><AdminRoute><Logs /></AdminRoute></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><AdminRoute><Settings /></AdminRoute></PrivateRoute>} />
            <Route path="/meta-capi" element={<PrivateRoute><AdminRoute><MetaCapi /></AdminRoute></PrivateRoute>} />
            <Route path="/webhook-diag" element={<PrivateRoute><AdminRoute><WebhookDiag /></AdminRoute></PrivateRoute>} />
            <Route path="/meta-verify" element={<PrivateRoute><AdminRoute><MetaVerify /></AdminRoute></PrivateRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;