import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SystemStatus } from '@/components/SystemStatus';
import { 
  Database, Shield, Activity, Terminal, AlertTriangle, 
  CheckCircle2, MessageSquare, TrendingUp, Clock, Loader2,
  Zap, Brain, RefreshCw, Send, ArrowRight
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

const Index = () => {
  const [stats, setStats] = useState({
    totalErrors: 0,
    pendingCorrections: 0,
    activeVersions: 0,
    recentLogs: [] as any[],
    activeFollowups: 0,
    scheduledRestarts: 0
  });
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [latency, setLatency] = useState<number>(0);

  useEffect(() => {
    fetchData();
    fetchRecentChats();
    fetchUpcomingTasks();
    measureLatency();
    
    // Suscripción a Logs (Auditoría)
    const logChannel = supabase
      .channel('logs-dashboard')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
        setStats(prev => ({
          ...prev,
          recentLogs: [payload.new, ...prev.recentLogs].slice(0, 15)
        }));
      })
      .subscribe();

    return () => { 
       supabase.removeChannel(logChannel); 
    };
  }, []);

  const measureLatency = async () => {
     const start = performance.now();
     await supabase.from('profiles').select('count', { count: 'exact', head: true });
     const end = performance.now();
     setLatency(Math.round(end - start));
  };

  const handleMasterRefresh = async () => {
    setRefreshing(true);
    toast.info("Iniciando Sincronización Maestra de todo el Cerebro...");
    try {
      // Ejecutar ambos scrapings y sincronizaciones
      await Promise.all([
        supabase.functions.invoke('scrape-main-website', {}),
        supabase.functions.invoke('auto-sync-knowledge', {})
      ]);
      toast.success("¡Cerebro refrescado! Todas las fuentes (Web y Bitácora) están actualizadas.");
      fetchData();
    } catch (err: any) {
      toast.error("Fallo en la sincronización maestra: " + err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchData = async () => {
    try {
      const [errorsRes, pendingRes, versionsRes, logsRes, followupsRes, restartsRes] = await Promise.all([
        supabase.from('errores_ia').select('count', { count: 'exact', head: true }),
        supabase.from('errores_ia').select('count', { count: 'exact', head: true }).eq('estado_correccion', 'REPORTADA'),
        supabase.from('versiones_prompts_aprendidas').select('*').order('created_at', { ascending: true }),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('leads').select('count', { count: 'exact', head: true }).not('next_followup_at', 'is', null),
        supabase.from('leads').select('count', { count: 'exact', head: true }).not('auto_restart_scheduled_at', 'is', null)
      ]);

      setStats({
        totalErrors: errorsRes.count || 0,
        pendingCorrections: pendingRes.count || 0,
        activeVersions: (versionsRes.data || []).length,
        recentLogs: logsRes.data || [],
        activeFollowups: followupsRes.count || 0,
        scheduledRestarts: restartsRes.count || 0
      });

      if (versionsRes.data && versionsRes.data.length > 0) {
        const mappedData = versionsRes.data.map((v, i) => ({
          name: v.version_numero || `v${i}`,
          accuracy: v.test_accuracy_nuevo || 70,
        }));
        setChartData(mappedData);
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

  const fetchUpcomingTasks = async () => {
     const { data: followups } = await supabase
        .from('leads')
        .select('id, nombre, next_followup_at, auto_restart_scheduled_at, followup_stage')
        .or('next_followup_at.not.is.null,auto_restart_scheduled_at.not.is.null')
        .order('next_followup_at', { ascending: true })
        .limit(5);
     
     if (followups) setUpcomingTasks(followups);
  };

  return (
    <Layout>
      <div className="space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Samurai Control Center</h1>
            <p className="text-slate-400">Estado de la red neuronal y flujos de trabajo.</p>
          </div>
          <div className="flex items-center gap-4">
            <Button 
               variant="outline" 
               className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 h-10"
               onClick={handleMasterRefresh}
               disabled={refreshing}
            >
               {refreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
               Sincronización Maestra
            </Button>
            <div className="flex items-center gap-3 bg-slate-900/50 p-2 px-4 rounded-full border border-slate-800 shadow-inner h-10">
               <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
               <span className="text-xs font-mono text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  Core: {connectionStatus === 'connected' ? 'Synced' : 'Offline'}
                  <span className="text-slate-600">|</span>
                  {latency}ms
               </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Alertas #CIA" value={stats.totalErrors} icon={AlertTriangle} color="text-red-500" bg="bg-red-500/10" footer="Correcciones Detectadas" />
          <StatCard title="Pendientes" value={stats.pendingCorrections} icon={Clock} color="text-yellow-500" bg="bg-yellow-500/10" footer="Reglas por validar" />
          <StatCard title="Follow-ups" value={stats.activeFollowups} icon={RefreshCw} color="text-blue-500" bg="bg-blue-500/10" footer="Reintentos en cola" />
          <StatCard title="Auto-Restarts" value={stats.scheduledRestarts} icon={Zap} color="text-orange-500" bg="bg-orange-500/10" footer="Post #STOP pendientes" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-8 space-y-8">
             <Card className="bg-slate-900 border-slate-800 overflow-hidden shadow-2xl flex flex-col">
               <CardHeader className="border-b border-slate-800 bg-slate-950/30 flex flex-row items-center justify-between">
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                     <TrendingUp className="w-5 h-5 text-indigo-400" /> 
                     Curva de Precisión (Accuracy)
                  </CardTitle>
                  <Badge className="bg-indigo-600">v0.8 AI Ready</Badge>
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
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} domain={[60, 100]} />
                        <Tooltip 
                           contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                           itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                        />
                        <Area type="monotone" dataKey="accuracy" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAcc)" />
                     </AreaChart>
                  </ResponsiveContainer>
               </CardContent>
             </Card>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-slate-900 border-slate-800 shadow-xl">
                    <CardHeader className="border-b border-slate-800 flex flex-row items-center justify-between py-3">
                    <CardTitle className="text-white text-[10px] uppercase tracking-widest flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-emerald-400" /> Live Feed
                    </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                    <div className="divide-y divide-slate-800">
                        {recentChats.map((chat) => (
                            <div key={chat.id} className="p-3 flex items-start gap-3 hover:bg-slate-800/50 transition-colors animate-in fade-in slide-in-from-bottom-2">
                                <div className={`p-1.5 rounded shrink-0 ${chat.emisor === 'SAMURAI' ? 'bg-indigo-600/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                                {chat.emisor === 'SAMURAI' ? <Zap className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-0.5">
                                    <span className="text-[10px] font-bold text-slate-300 truncate">
                                        {chat.leads?.nombre || 'Desconocido'}
                                    </span>
                                    <span className="text-[9px] text-slate-600 font-mono">{new Date(chat.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                                <p className="text-[11px] text-slate-400 line-clamp-1 italic">
                                    "{chat.mensaje}"
                                </p>
                                </div>
                            </div>
                        ))}
                    </div>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800 shadow-xl">
                    <CardHeader className="border-b border-slate-800 flex flex-row items-center justify-between py-3">
                    <CardTitle className="text-white text-[10px] uppercase tracking-widest flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-blue-400" /> Próximas Acciones
                    </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                    <div className="divide-y divide-slate-800">
                        {upcomingTasks.length === 0 ? (
                            <div className="p-6 text-center text-slate-500 text-xs italic">No hay acciones programadas</div>
                        ) : upcomingTasks.map((task) => {
                            const isRestart = !!task.auto_restart_scheduled_at;
                            const time = isRestart ? task.auto_restart_scheduled_at : task.next_followup_at;
                            return (
                                <div key={task.id} className="p-3 flex items-start gap-3 hover:bg-slate-800/50 transition-colors">
                                    <div className={`p-1.5 rounded shrink-0 ${isRestart ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                        {isRestart ? <Zap className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-slate-300">{task.nombre}</span>
                                            <span className="text-[9px] text-slate-600 font-mono">{new Date(time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </div>
                                        <p className="text-[9px] text-slate-500 uppercase flex items-center gap-1 mt-0.5">
                                            {isRestart ? 'Auto-Restart' : `Follow-up Stage ${task.followup_stage || 1}`}
                                            <ArrowRight className="w-2 h-2" />
                                            {new Date(time).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    </CardContent>
                </Card>
             </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <SystemStatus />

            <Card className="bg-black border-slate-800 font-mono text-[10px] shadow-2xl flex flex-col rounded-xl overflow-hidden min-h-[400px]">
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
                 <p className="text-green-500/60 mb-2">SAMURAI_OS [Version 0.804] (c) 2026 Dyad Systems.</p>
                 {stats.recentLogs.map((log, i) => (
                    <div key={i} className="animate-in fade-in slide-in-from-left-2 duration-300 flex items-start gap-2">
                       <span className="text-slate-600 shrink-0">[{new Date(log.created_at).toLocaleTimeString()}]</span> 
                       <span className={`shrink-0 px-1 rounded h-fit ${log.action === 'ERROR' ? 'bg-red-500/20 text-red-400' : log.action === 'CHAT' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                          {log.action}
                       </span> 
                       <span className="text-slate-300 break-all">{log.description}</span>
                    </div>
                 ))}
              </div>
            </Card>
          </div>
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
      <div className={`p-3 rounded-xl ${bg} ${color} group-hover:rotate-12 transition-transform shadow-inner`}>
         <Icon className="w-6 h-6" />
      </div>
    </div>
    <p className="mt-4 text-[10px] text-slate-500 font-mono uppercase tracking-tighter">{footer}</p>
  </Card>
);

export default Index;