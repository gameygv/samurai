import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Brain, Settings as SettingsIcon, Database, LogOut, 
  Users, FileText, UserCircle, GraduationCap, MessageSquare, 
  GitBranch, Link as LinkIcon, Image, Sparkles, BookOpen, Clock,
  Archive, Globe, CreditCard, BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/avatar";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const menuGroups = [
    {
      title: "PRINCIPAL",
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
      ]
    },
    {
      title: "SAMURAI AI",
      items: [
        { icon: Brain, label: 'Cerebro Core', path: '/brain' },
        { icon: GitBranch, label: 'Control de Versiones', path: '/brain?tab=part5' },
      ]
    },
    {
      title: "RECURSOS",
      items: [
        { icon: GraduationCap, label: 'Aprendizaje IA', path: '/learning' },
        { icon: Database, label: 'Base Conocimiento', path: '/knowledge' },
        { icon: Globe, label: 'Sitio Web Principal', path: '/website-content' },
        { icon: Image, label: 'Media Manager', path: '/media' },
      ]
    },
    {
      title: "GESTIÓN",
      items: [
        { icon: MessageSquare, label: 'Radar de Leads', path: '/leads' },
        { icon: CreditCard, label: 'Pagos & Ventas', path: '/payments' },
        { icon: Archive, label: 'Archivo de Chats', path: '/archive' },
        { icon: Users, label: 'Usuarios', path: '/users' },
        { icon: FileText, label: 'Logs & Actividad', path: '/logs' },
      ]
    },
    {
      title: "SISTEMA",
      items: [
        { icon: BarChart3, label: 'Meta CAPI', path: '/meta-capi' },
        { icon: BookOpen, label: 'Manual de Ayuda', path: '/manual' },
        { icon: Clock, label: 'Follow-ups Auto', path: '/settings?tab=followups' },
        { icon: LinkIcon, label: 'Integraciones', path: '/settings?tab=webhooks' },
        { icon: SettingsIcon, label: 'API Keys', path: '/settings?tab=secrets' },
      ]
    }
  ];

  return (
    <div className="flex min-h-screen bg-slate-950 text-white font-sans">
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 hidden md:flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold shadow-lg shadow-red-900/50">
            侍
          </div>
          <span className="font-bold text-xl tracking-tight uppercase">Samurai</span>
        </div>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-6 py-2">
            {menuGroups.map((group, i) => (
              <div key={i}>
                <h4 className="mb-2 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {group.title}
                </h4>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path.split('?')[0];
                    
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200",
                          isActive 
                            ? "bg-red-600/10 text-red-500 font-medium border-l-2 border-red-600" 
                            : "text-slate-400 hover:bg-slate-800 hover:text-white"
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

        <div className="p-4 border-t border-slate-800">
           <div className="flex items-center gap-2 px-2 py-1 mb-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs text-slate-400 font-mono">SAMURAI: ONLINE</span>
           </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto flex flex-col">
        <header className="h-16 border-b border-slate-800 bg-slate-900/30 backdrop-blur-md flex items-center px-8 justify-between sticky top-0 z-10">
          <h2 className="text-lg font-medium text-slate-200">
            Panel de Control
          </h2>
          
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-slate-800">
                  <Avatar className="h-9 w-9 border border-slate-700">
                    <AvatarFallback className="bg-slate-800 text-red-500 font-bold">
                      {profile?.username?.substring(0, 2).toUpperCase() || 'US'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-slate-900 border-slate-800 text-slate-200" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none text-white">{profile?.full_name || 'Usuario'}</p>
                    <p className="text-xs leading-none text-slate-500">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-800" />
                <DropdownMenuItem className="focus:bg-slate-800 focus:text-white cursor-pointer" onClick={() => navigate('/profile')}>
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Mi Perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-slate-800 focus:text-white cursor-pointer" onClick={() => navigate('/manual')}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  <span>Manual de Ayuda</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-slate-800 focus:text-white cursor-pointer" onClick={() => navigate('/settings')}>
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  <span>Configuración API</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-800" />
                <DropdownMenuItem className="text-red-500 focus:bg-red-500/10 focus:text-red-500 cursor-pointer" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar Sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        
        <div className="p-8 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
};

const Avatar = ({ children, className }: any) => <div className={cn("rounded-full overflow-hidden", className)}>{children}</div>;
const AvatarFallback = ({ children, className }: any) => <div className={cn("flex items-center justify-center w-full h-full", className)}>{children}</div>;
const AvatarImage = ({ src }: any) => <img src={src} className="w-full h-full object-cover" />;

export default Layout;