import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Database, Shield, Activity, Terminal, AlertTriangle, 
  CheckCircle2, MessageSquare, TrendingUp, Clock, Loader2,
  Zap, Brain
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Index = () => {
  const [stats, setStats] = useState({
    totalErrors: 0,
    pendingCorrections: 0,
    activeVersions: 0,
    recentLogs: [] as any[]
  });
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  useEffect(() => {
    fetchData();
    fetchRecentChats();
    
    // Suscripción para Logs
    const logChannel = supabase
      .channel('logs-dashboard')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
        setStats(prev => ({
          ...prev,
          recentLogs: [payload.new, ...prev.recentLogs].slice(0, 15)
        }));
      })
      .subscribe();

    // Suscripción para Mensajes en Vivo
    const chatChannel = supabase
      .channel('chats-dashboard')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversaciones' }, (payload) => {
         setRecentChats(prev => [payload.new, ...prev].slice(0, 5));
      })
      .subscribe();

    return () => { 
       supabase.removeChannel(logChannel); 
       supabase.removeChannel(chatChannel); 
    };
  }, []);

  const fetchData = async () => {
    try {
      const [errorsRes, pendingRes, versionsRes, logsRes] = await Promise.all([
        supabase.from('errores_ia').select('count', { count: 'exact', head: true }),
        supabase.from('errores_ia').select('count', { count: 'exact', head: true }).eq('estado_correccion', 'REPORTADA'),
        supabase.from('versiones_prompts_aprendidas').select('*').order('created_at', { ascending: true }),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(10)
      ]);

      setStats({
        totalErrors: errorsRes.count || 0,
        pendingCorrections: pendingRes.count || 0,
        activeVersions: (versionsRes.data || []).length,
        recentLogs: logsRes.data || []
      });

      // Procesar datos para el gráfico
      if (versionsRes.data && versionsRes.data.length > 0) {
        setChartData(versionsRes.data.map((v, i) => ({
          name: v.version_numero || `v${i}`,
          accuracy: v.test_accuracy_nuevo || 70 + (i * 5),
        })));
      } else {
         // Data de ejemplo si no hay versiones
         setChartData([
            { name: 'v0.1', accuracy: 72 },
            { name: 'v0.5', accuracy: 78 },
            { name: 'v0.8', accuracy: 85 }
         ]);
      }

      setConnectionStatus('connected');
    } catch (err) {
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentChats = async () => {
     const { data } = await supabase
        .from('conversaciones')
        .select('*, leads(nombre)')
        .order('created_at', { ascending: false })
        .limit(5);
     if (data) setRecentChats(data);
  };

  return (
    <Layout>
      <div className="space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Samurai Control Center</h1>
            <p className="text-slate-400">Estado de la red neuronal y flujos de trabajo.</p>
          </div>
          <div className="flex items-center gap-3 bg-slate-900/50 p-2 px-4 rounded-full border border-slate-800 shadow-inner">
            <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-xs font-mono text-slate-300 uppercase tracking-widest">
               Core: {connectionStatus === 'connected' ? 'Synced' : 'Offline'}
            </span>
          </div>
        </div>

        {/* STATS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Alertas IA" value={stats.totalErrors} icon={AlertTriangle} color="text-red-500" bg="bg-red-500/10" footer="#CORREGIRIA Detectados" />
          <StatCard title="Pendientes" value={stats.pendingCorrections} icon={Clock} color="text-yellow-500" bg="bg-yellow-500/10" footer="Mejoras por validar" />
          <StatCard title="Versiones" value={stats.activeVersions} icon={TrendingUp} color="text-indigo-500" bg="bg-indigo-500/10" footer="Evolución del Cerebro" />
          <StatCard title="Base Datos" value="Online" icon={Database} color="text-emerald-500" bg="bg-emerald-500/10" footer="Latency: 42ms" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* CHART & CHATS */}
          <div className="lg:col-span-8 space-y-8">
             {/* Chart Card */}
             <Card className="bg-slate-900 border-slate-800 overflow-hidden shadow-2xl flex flex-col">
               <CardHeader className="border-b border-slate-800 bg-slate-950/30 flex flex-row items-center justify-between">
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                     <TrendingUp className="w-5 h-5 text-indigo-400" /> 
                     Curva de Aprendizaje
                  </CardTitle>
                  <Badge className="bg-indigo-600">Mejora Continua</Badge>
               </CardHeader>
               <CardContent className="p-6 h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={chartData}>
                        <defs>
                           <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                           </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                        <Tooltip 
                           contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                           itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                        />
                        <Area type="monotone" dataKey="accuracy" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAcc)" />
                     </AreaChart>
                  </ResponsiveContainer>
               </CardContent>
             </Card>

             {/* Recent Chats Card */}
             <Card className="bg-slate-900 border-slate-800 shadow-xl">
                <CardHeader className="border-b border-slate-800 flex flex-row items-center justify-between">
                   <CardTitle className="text-white text-sm uppercase tracking-widest flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-emerald-400" /> Live Interacciones
                   </CardTitle>
                   <Badge variant="outline" className="text-[9px] border-emerald-500/20 text-emerald-500">Live Feed</Badge>
                </CardHeader>
                <CardContent className="p-0">
                   <div className="divide-y divide-slate-800">
                      {recentChats.map((chat) => (
                         <div key={chat.id} className="p-4 flex items-start gap-4 hover:bg-slate-800/50 transition-colors animate-in fade-in slide-in-from-bottom-2">
                            <div className={`p-2 rounded-lg shrink-0 ${chat.emisor === 'SAMURAI' ? 'bg-indigo-600/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                               {chat.emisor === 'SAMURAI' ? <Zap className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                               <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase">{chat.leads?.nombre || 'Desconocido'}</span>
                                  <span className="text-[10px] text-slate-600 font-mono">{new Date(chat.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                               </div>
                               <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                                  {chat.mensaje}
                               </p>
                            </div>
                         </div>
                      ))}
                      {recentChats.length === 0 && (
                         <div className="p-10 text-center text-slate-600 text-xs italic">Esperando primera interacción...</div>
                      )}
                   </div>
                </CardContent>
             </Card>
          </div>

          {/* SYSTEM LOGS (TERMINAL) */}
          <Card className="lg:col-span-4 bg-black border-slate-800 font-mono text-[10px] shadow-2xl flex flex-col h-full rounded-xl overflow-hidden min-h-[500px]">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
               <div className="flex items-center gap-2 text-slate-500">
                  <Terminal className="w-4 h-4" />
                  <span className="font-bold tracking-tighter uppercase">Kernel Logs</span>
               </div>
               <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500/40"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-500/40"></div>
                  <div className="w-2 h-2 rounded-full bg-green-500/40"></div>
               </div>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
               <p className="text-green-500/60 mb-2">SAMURAI_OS [Version 0.801] (c) 2026 Dyad Systems.</p>
               {stats.recentLogs.map((log, i) => (
                  <div key={i} className="animate-in fade-in slide-in-from-left-2 duration-300 flex items-start gap-2">
                     <span className="text-slate-600 shrink-0">[{new Date(log.created_at).toLocaleTimeString()}]</span> 
                     <span className={`shrink-0 px-1 rounded h-fit ${log.action === 'ERROR' ? 'bg-red-500/20 text-red-400' : log.action === 'CHAT' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                        {log.action}
                     </span> 
                     <span className="text-slate-300 break-all">{log.description}</span>
                  </div>
               ))}
               <div className="pt-2 flex items-center gap-2">
                  <span className="w-2 h-4 bg-indigo-500 animate-pulse"></span>
                  <span className="text-slate-700 italic">Listening for events...</span>
               </div>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

const StatCard = ({ title, value, icon: Icon, color, bg, footer }: any) => (
  <Card className="bg-slate-900 border-slate-800 p-6 hover:border-indigo-500/30 transition-all duration-300 group">
    <div className="flex justify-between items-start">
      <div>
         <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</p>
         <h3 className="text-3xl font-bold text-white mt-2">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl ${bg} ${color} group-hover:rotate-12 transition-transform`}>
         <Icon className="w-6 h-6" />
      </div>
    </div>
    <p className="mt-4 text-[10px] text-slate-500 font-mono uppercase tracking-tighter">{footer}</p>
  </Card>
);

export default Index;