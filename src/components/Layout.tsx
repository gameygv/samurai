import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  LayoutDashboard, Brain, Settings as SettingsIcon, LogOut, 
  Users, UserCircle, Contact, Tag, Image, Globe, CreditCard, BarChart3, Zap, Trello, Menu, Activity, Search, MessageCircle, Command, GraduationCap, Megaphone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, user, signOut, isAdmin, isDev, isManager } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [brandName, setBrandName] = useState('Samurai Workspace');

  const [searchOpen, setSearchOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('app_config').select('value').eq('key', 'brand_name').maybeSingle().then(({ data }) => {
       if (data?.value) setBrandName(data.value);
    });

    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
     if (globalQuery.length > 2 && user) {
        let query = supabase.from('leads').select('id, nombre, telefono, email').or(`nombre.ilike.%${globalQuery}%,telefono.ilike.%${globalQuery}%`);
        
        // PRIVACIDAD: Si no es manager, filtrar resultados de búsqueda global
        if (!isManager) {
            query = query.eq('assigned_to', user.id);
        }

        query.limit(5).then(({data}) => {
            if(data) setSearchResults(data);
        });
     } else {
        setSearchResults([]);
     }
  }, [globalQuery, user, isManager]);

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
        { icon: Globe, label: 'Base Conocimiento', path: '/knowledge', roles: ['admin', 'dev'] },
        { icon: Image, label: 'Media Manager', path: '/media', roles: ['admin', 'dev'] },
      ]
    },
    {
      title: "GESTIÓN",
      items: [
        { icon: Trello, label: 'Pipeline Ventas', path: '/pipeline', roles: ['any'] },
        { icon: MessageCircle, label: 'Radar Leads', path: '/leads', roles: ['admin', 'dev', 'gerente'] },
        { icon: Contact, label: 'Contactos', path: '/contacts', roles: ['any'] },
        { icon: Tag, label: 'Mis Plantillas', path: '/tools', roles: ['any'] },
        { icon: GraduationCap, label: 'Academia', path: '/academic', roles: ['admin', 'dev', 'gerente'] },
        { icon: Megaphone, label: 'Campañas', path: '/campaigns', roles: ['admin', 'dev', 'gerente'] },
        { icon: CreditCard, label: 'Pagos & Ventas', path: '/payments', roles: ['any'] },
        { icon: Globe, label: 'Archivo de Chats', path: '/archive', roles: ['admin', 'dev', 'gerente'] },
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
    <div className="flex flex-col h-full bg-[#0a0a0c]">
      <div className="p-6 flex items-center gap-3 border-b border-[#1a1a1a]">
        <div className="w-10 h-10 flex items-center justify-center shrink-0">
          <img src="/logo.png" alt="Brand Logo" className="w-full h-full object-contain drop-shadow-md" />
        </div>
        <div className="flex flex-col">
           <span className="font-bold text-[14px] tracking-tight uppercase text-slate-50 leading-none">{brandName}</span>
           <span className="text-[9px] text-amber-500 font-mono font-bold mt-1 flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"/> KERNEL ONLINE
           </span>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div className="space-y-6 py-4">
          {menuGroups.map((group, i) => {
            const visibleItems = group.items.filter(item => 
               item.roles.includes('any') || 
               (isAdmin && item.roles.includes('admin')) || 
               (isDev && item.roles.includes('dev')) ||
               (isManager && item.roles.includes('gerente'))
            );

            if (visibleItems.length === 0) return null;

            return (
              <div key={i}>
                <h4 className="mb-2 px-2 text-[9px] font-bold text-[#7A8A9E] uppercase tracking-widest">
                  {group.title}
                </h4>
                <div className="space-y-1">
                  {visibleItems.map((item) => {
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
                            ? "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-900/20" 
                            : "text-[#7A8A9E] hover:bg-[#161618] hover:text-slate-200"
                        )}
                      >
                        <Icon className={cn("w-4 h-4", isActive ? "text-white" : "text-[#7A8A9E]")} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t border-[#1a1a1a]">
         <div className="bg-[#121214] rounded-xl p-3 border border-[#222225] hover:border-indigo-500/50 hover:bg-[#161618] transition-colors cursor-pointer group" onClick={() => navigate('/profile')}>
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[10px] font-bold text-indigo-400 border border-[#222225] shadow-inner shrink-0">
                  {profile?.full_name?.substring(0, 2).toUpperCase() || '??'}
               </div>
               <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-200 truncate group-hover:text-white transition-colors">{profile?.full_name || 'Usuario'}</p>
                  <p className="text-[9px] text-indigo-400 uppercase font-bold tracking-widest mt-0.5 flex items-center gap-1">
                    <UserCircle className="w-3 h-3" /> Mi Perfil / Ajustes
                  </p>
               </div>
               <button onClick={(e) => { e.stopPropagation(); handleLogout(); }} title="Cerrar Sesión" className="text-slate-600 hover:text-red-400 transition-colors p-2 z-10 relative bg-[#0a0a0c] rounded-lg border border-[#222225]">
                  <LogOut className="w-4 h-4" />
               </button>
            </div>
         </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#050505] text-slate-50 font-sans">
      <aside className="w-64 border-r border-[#1a1a1a] bg-[#0a0a0c] hidden md:flex flex-col z-20">
        <NavContent />
      </aside>

      <main className="flex-1 overflow-auto flex flex-col">
        <header className="h-16 border-b border-[#1a1a1a] bg-[#0a0a0c]/80 backdrop-blur-xl flex items-center px-4 md:px-8 justify-between sticky top-0 z-10">
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden text-slate-400 hover:text-white">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 border-r-[#1a1a1a] w-72">
              <NavContent />
            </SheetContent>
          </Sheet>
          
          <div className="flex-1 flex justify-center max-w-2xl mx-auto px-4 hidden sm:block">
             <button 
               onClick={() => setSearchOpen(true)}
               className="w-full flex items-center justify-between px-4 py-2 bg-[#121214] border border-[#222225] hover:border-indigo-500/50 hover:bg-[#161618] transition-all rounded-xl text-slate-500 text-sm group"
             >
                <div className="flex items-center gap-2">
                   <Search className="w-4 h-4 group-hover:text-indigo-400 transition-colors" />
                   <span>Búsqueda global y comandos...</span>
                </div>
                <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border border-[#222225] bg-[#0a0a0c] px-1.5 font-mono text-[10px] font-medium text-slate-400">
                   <Command className="w-3 h-3" /> K
                </kbd>
             </button>
          </div>

          <div className="flex items-center gap-2">
             <div className="hidden sm:flex flex-col items-end mr-2">
                <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest">Sys Health</span>
                <span className="text-[10px] text-emerald-500 font-mono font-bold">100% STABLE</span>
             </div>
             <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
          </div>
        </header>
        
        <div className="p-4 md:p-8 flex-1">
          {children}
        </div>
      </main>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
         <DialogContent className="p-0 border-0 bg-transparent shadow-2xl sm:max-w-2xl top-[20%] translate-y-0">
            <div className="bg-[#0f0f11] border border-[#222225] rounded-2xl overflow-hidden shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)]">
               <div className="flex items-center px-4 border-b border-[#222225] bg-[#161618]">
                  <Search className="w-5 h-5 text-indigo-400" />
                  <input 
                     autoFocus
                     value={globalQuery}
                     onChange={e => setGlobalQuery(e.target.value)}
                     className="flex-1 h-14 bg-transparent border-0 text-white placeholder:text-slate-500 focus:ring-0 px-4 outline-none text-lg"
                     placeholder="Busca leads, contactos o escribe un comando..."
                  />
                  <kbd className="hidden sm:inline-flex h-6 items-center rounded border border-[#222225] bg-[#0a0a0c] px-2 font-mono text-[10px] font-bold text-slate-500">ESC</kbd>
               </div>
               
               <ScrollArea className="max-h-[350px]">
                  <div className="p-2">
                     {globalQuery.length > 2 && searchResults.length === 0 && (
                        <div className="p-6 text-center text-sm text-slate-500 italic">No se encontraron resultados para "{globalQuery}"</div>
                     )}

                     {searchResults.length > 0 && (
                        <div className="mb-4">
                           <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Prospectos y Contactos</div>
                           {searchResults.map(res => (
                              <button 
                                 key={res.id} 
                                 onClick={() => { setSearchOpen(false); navigate(`/inbox`); }}
                                 className="w-full flex items-center gap-3 px-3 py-3 hover:bg-[#161618] rounded-xl text-left transition-colors group"
                              >
                                 <div className="w-8 h-8 rounded-full bg-[#121214] border border-[#222225] flex items-center justify-center text-indigo-400 shrink-0">
                                    <UserCircle className="w-4 h-4" />
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-200 group-hover:text-white">{res.nombre}</span>
                                    <span className="text-[10px] text-slate-500 font-mono">{res.telefono} {res.email ? `• ${res.email}` : ''}</span>
                                 </div>
                              </button>
                           ))}
                        </div>
                     )}

                     {globalQuery.length <= 2 && (
                        <>
                           <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Comandos Rápidos</div>
                           <div className="space-y-1">
                              <button onClick={() => {setSearchOpen(false); navigate('/inbox')}} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#161618] rounded-xl text-left text-sm text-slate-300">
                                 <MessageCircle className="w-4 h-4 text-slate-500" /> Ir a Bandeja de Entrada (Inbox)
                              </button>
                              <button onClick={() => {setSearchOpen(false); navigate('/pipeline')}} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#161618] rounded-xl text-left text-sm text-slate-300">
                                 <Trello className="w-4 h-4 text-slate-500" /> Abrir Embudo de Ventas (Pipeline)
                              </button>
                              {isAdmin && (
                                 <button onClick={() => {setSearchOpen(false); navigate('/settings')}} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#161618] rounded-xl text-left text-sm text-slate-300">
                                    <SettingsIcon className="w-4 h-4 text-slate-500" /> Configuración del Sistema
                                 </button>
                              )}
                           </div>
                        </>
                     )}
                  </div>
               </ScrollArea>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );
};

export default Layout;