import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  LayoutDashboard, Brain, Settings as SettingsIcon, Database, LogOut, 
  Users, FileText, UserCircle, MessageSquare, Contact,
  GitBranch, Link as LinkIcon, Image, Sparkles, BookOpen, Clock,
  Archive, Globe, CreditCard, BarChart3, Zap, Trello, Menu, Activity, Search, MessageCircle, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, isAdmin, isDev } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [brandName, setBrandName] = useState('Samurai Workspace');

  useEffect(() => {
    supabase.from('app_config').select('value').eq('key', 'brand_name').maybeSingle().then(({ data }) => {
       if (data?.value) setBrandName(data.value);
    });
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const menuGroups = [
    {
      title: "PRINCIPAL",
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['any'] },
        { icon: MessageCircle, label: 'Chats (Inbox)', path: '/inbox', roles: ['any'] },
        { icon: Activity, label: 'Monitor Live', path: '/activity', roles: ['admin', 'dev'] },
      ]
    },
    {
      title: "INTELIGENCIA",
      items: [
        { icon: Brain, label: 'Cerebro Core', path: '/brain', roles: ['admin', 'dev'] },
        { icon: Zap, label: 'Bitácora #CIA', path: '/learning', roles: ['admin', 'dev'] },
      ]
    },
    {
      title: "RECURSOS",
      items: [
        { icon: Globe, label: 'Verdad Maestra', path: '/website-content', roles: ['admin', 'dev'] },
        { icon: Database, label: 'Base Conocimiento', path: '/knowledge', roles: ['admin', 'dev'] },
        { icon: Image, label: 'Media Manager', path: '/media', roles: ['admin', 'dev'] },
      ]
    },
    {
      title: "GESTIÓN",
      items: [
        { icon: Trello, label: 'Pipeline Ventas', path: '/pipeline', roles: ['any'] },
        { icon: MessageSquare, label: 'Radar Leads', path: '/leads', roles: ['any'] },
        { icon: Contact, label: 'Contactos', path: '/contacts', roles: ['any'] },
        { icon: CreditCard, label: 'Pagos & Ventas', path: '/payments', roles: ['admin', 'dev'] },
        { icon: Archive, label: 'Archivo de Chats', path: '/archive', roles: ['any'] },
      ]
    },
    {
      title: "SISTEMA",
      items: [
        { icon: Users, label: 'Equipo', path: '/users', roles: ['admin', 'dev'] },
        { icon: BarChart3, label: 'Meta CAPI', path: '/meta-capi', roles: ['admin', 'dev'] },
        { icon: SettingsIcon, label: 'Ajustes', path: '/settings', roles: ['admin', 'dev'] },
      ]
    }
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 flex items-center justify-center shrink-0">
          <img src="/logo.png" alt="Brand Logo" className="w-full h-full object-contain drop-shadow-md" />
        </div>
        <div className="flex flex-col">
           <span className="font-bold text-[14px] tracking-tight uppercase text-slate-50 leading-none">{brandName}</span>
           <span className="text-[9px] text-amber-500 font-mono font-bold mt-1 animate-pulse flex items-center gap-1">
              <Shield className="w-2 h-2" /> KERNEL ONLINE
           </span>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div className="space-y-6 py-2">
          {menuGroups.map((group, i) => (
              <div key={i}>
                <h4 className="mb-2 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {group.title}
                </h4>
                <div className="space-y-1">
                  {group.items.filter(item => item.roles.includes('any') || (isAdmin && item.roles.includes('admin')) || (isDev && item.roles.includes('dev'))).map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                          isActive 
                            ? "bg-indigo-900/80 text-amber-500 font-medium shadow-md" 
                            : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                        )}
                      >
                        <Icon className={cn("w-4 h-4", isActive ? "text-amber-500" : "text-slate-500")} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
          ))}
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t border-slate-800">
         <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-indigo-900 flex items-center justify-center text-[10px] font-bold text-amber-500 border border-indigo-500/30">
                  {profile?.full_name?.substring(0, 2).toUpperCase() || '??'}
               </div>
               <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-200 truncate">{profile?.full_name || 'Usuario'}</p>
                  <p className="text-[9px] text-slate-500 uppercase font-mono">{profile?.role || 'dev'}</p>
               </div>
               <button onClick={handleLogout} title="Cerrar Sesión" className="text-slate-600 hover:text-red-400 transition-colors">
                  <LogOut className="w-4 h-4" />
               </button>
            </div>
         </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-50 font-sans">
      <aside className="w-64 border-r border-slate-800 bg-slate-900/80 hidden md:flex flex-col shadow-2xl z-20">
        <NavContent />
      </aside>

      <main className="flex-1 overflow-auto flex flex-col">
        <header className="h-16 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-xl flex items-center px-4 md:px-8 justify-between sticky top-0 z-10">
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden text-slate-400">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 bg-slate-900 border-r-slate-800 w-72">
              <NavContent />
            </SheetContent>
          </Sheet>
          
          <div className="flex-1 flex justify-center max-w-xl mx-auto px-4 hidden sm:block">
             <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <Input placeholder="Comando rápido o búsqueda..." className="pl-10 bg-slate-950/50 border-slate-800 rounded-full h-9 text-xs focus-visible:ring-amber-500" />
             </div>
          </div>

          <div className="flex items-center gap-2">
             <div className="hidden sm:flex flex-col items-end mr-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">System Health</span>
                <span className="text-[10px] text-emerald-500 font-mono">STABLE 100%</span>
             </div>
             <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></div>
          </div>
        </header>
        
        <div className="p-4 md:p-8 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;