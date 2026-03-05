import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Brain, Settings as SettingsIcon, Database, LogOut, 
  Users, FileText, UserCircle, MessageSquare, 
  GitBranch, Link as LinkIcon, Image, Sparkles, BookOpen, Clock,
  Archive, Globe, CreditCard, BarChart3, Zap, Trello, Menu, Activity, Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const menuGroups = [
    {
      title: "PRINCIPAL",
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: Activity, label: 'Monitor Live', path: '/activity' },
      ]
    },
    {
      title: "INTELIGENCIA",
      items: [
        { icon: Brain, label: 'Cerebro Core', path: '/brain' },
        { icon: Zap, label: 'Bitácora #CIA', path: '/learning' },
      ]
    },
    {
      title: "RECURSOS",
      items: [
        { icon: Globe, label: 'Verdad Maestra', path: '/website-content' },
        { icon: Database, label: 'Base Conocimiento', path: '/knowledge' },
        { icon: Image, label: 'Media Manager', path: '/media' },
      ]
    },
    {
      title: "GESTIÓN",
      items: [
        { icon: Trello, label: 'Pipeline Ventas', path: '/pipeline' },
        { icon: MessageSquare, label: 'Radar de Leads', path: '/leads' },
        { icon: CreditCard, label: 'Pagos & Ventas', path: '/payments' },
        { icon: Archive, label: 'Archivo de Chats', path: '/archive' },
      ]
    },
    {
      title: "SISTEMA",
      items: [
        { icon: BarChart3, label: 'Meta CAPI', path: '/meta-capi' },
        { icon: BookOpen, label: 'Manual de Ayuda', path: '/manual' },
        { icon: SettingsIcon, label: 'Ajustes', path: '/settings' },
      ]
    }
  ];

  const userInitials = (profile?.username?.substring(0, 2) || 'US').toUpperCase();

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 flex items-center justify-center shrink-0">
          <img src="/logo.png" alt="The Elephant Bowl Logo" className="w-full h-full object-contain drop-shadow-md" />
        </div>
        <span className="font-bold text-[15px] tracking-tight uppercase text-slate-50 leading-tight">The Elephant Bowl</span>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div className="space-y-6 py-2">
          {menuGroups.map((group, i) => (
            <div key={i}>
              <h4 className="mb-2 px-2 text-[10px] font-bold text-slate-400/80 uppercase tracking-widest">
                {group.title}
              </h4>
              <div className="space-y-1">
                {group.items.map((item) => {
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
                          ? "bg-indigo-900/80 text-amber-500 font-medium shadow-md shadow-black/10" 
                          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-50 font-sans">
      <aside className="w-64 border-r border-slate-800 bg-slate-900/80 hidden md:flex flex-col shadow-2xl z-20">
        <NavContent />
      </aside>

      <main className="flex-1 overflow-auto flex flex-col">
        <header className="h-16 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-xl flex items-center px-4 md:px-8 justify-between sticky top-0 z-10 gap-8">
          <div className="flex items-center gap-4 flex-1">
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-slate-400 hover:text-amber-500">
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 bg-slate-900 border-r-slate-800 w-72">
                <NavContent />
              </SheetContent>
            </Sheet>
            
            <div className="relative max-w-md w-full hidden sm:block">
               <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
               <Input 
                  placeholder="Buscar Lead, Ciudad o Recurso..." 
                  className="pl-10 bg-slate-950/50 border-slate-800 h-9 text-xs focus-visible:ring-amber-500 rounded-full"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/leads?search=${globalSearch}`)}
               />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-slate-800 p-0 border border-slate-700">
                  <div className="h-full w-full rounded-full bg-indigo-900 flex items-center justify-center text-amber-500 font-bold overflow-hidden shadow-inner">
                    {userInitials}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-slate-900 border-slate-800 text-slate-200" align="end">
                <DropdownMenuItem onClick={() => navigate('/profile')}>Mi Perfil</DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-800" />
                <DropdownMenuItem className="text-red-400 focus:bg-red-900/20 focus:text-red-300" onClick={handleLogout}>Cerrar Sesión</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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