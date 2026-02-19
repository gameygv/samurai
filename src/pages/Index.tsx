import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SystemStatus } from '@/components/SystemStatus';
import { 
  Database, Shield, Activity, Terminal, AlertTriangle, 
  CheckCircle2, MessageSquare, TrendingUp, Clock, Loader2,
  Zap, Brain, RefreshCw, Send, ArrowRight, UserCheck, ShieldAlert
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
    scheduledRestarts: 0,
    identifiedLeads: 0,
    totalLeads: 0
  });
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<any[]>([]);
  const [handoffs, setHandoffs] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [latency, setLatency] = useState<number>(0);

  useEffect(() => {
    fetchData();
    fetchRecentChats();
    fetchUpcomingTasks();
    fetchHandoffs();
    measureLatency();
    
    const logChannel = supabase
      .channel('logs-dashboard')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
        setStats(prev => ({
          ...prev,
          recentLogs: [payload.new, ...prev.recentLogs].slice(0, 15)
        }));
      })
      .subscribe();

    return () => { supabase.removeChannel(logChannel); };
  }, []);

  const measureLatency = async () => {
     const start = performance.now();
     await supabase.from('profiles').select('count', { count: 'exact', head: true });
     const end = performance.now();
     setLatency(Math.round(end - start));
  };

  const fetchData = async () => {
    try {
      const [errorsRes, pendingRes, versionsRes, logsRes, followupsRes, leadsRes] = await Promise.all([
        supabase.from('errores_ia').select('count', { count: 'exact', head: true }),
        supabase.from('errores_ia').select('count', { count: 'exact', head: true }).eq('estado_correccion', 'REPORTADA'),
        supabase.from('versiones_prompts_aprendidas').select('*').order('created_at', { ascending: true }),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('leads').select('count', { count: 'exact', head: true }).not('next_followup_at', 'is', null),
        supabase.from('leads').select('*')
      ]);

      const identified = (leadsRes.data || []).filter(l => l.nombre && !l.nombre.includes('Nuevo Lead')).length;

      setStats({
        totalErrors: errorsRes.count || 0,
        pendingCorrections: pendingRes.count || 0,
        activeVersions: (versionsRes.data || []).length,
        recentLogs: logsRes.data || [],
        activeFollowups: followupsRes.count || 0,
        scheduledRestarts: 0,
        identifiedLeads: identified,
        totalLeads: (leadsRes.data || []).length
      });

      if (versionsRes.data && versionsRes.data.length > 0) {
        setChartData(versionsRes.data.map((v, i) => ({ name: v.version_numero || `v${i}`, accuracy: v.test_accuracy_nuevo || 70 })));
      }
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentChats = async () => {
     const { data } = await supabase.from('conversaciones').select('*, leads(nombre)').order('created_at', { ascending: false }).limit(5);
     if (data) setRecentChats(data);
  };

  const fetchUpcomingTasks = async () => {
     const { data } = await supabase.from('leads').select('id, nombre, next_followup_at, followup_stage').not('next_followup_at', 'is', null).order('next_followup_at', { ascending: true }).limit(5);
     if (data) setUpcomingTasks(data);
  };

  const fetchHandoffs = async () => {
     const { data } = await supabase.from('leads').select('*').eq('ai_paused', true).order('last_message_at', { ascending: false }).limit(3);
     if (data) setHandoffs(data);
  };

  return (
    <Layout>
      <div className="space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Samurai Control Center</h1>
            <p className="text-slate-400">Estado de la red neuronal y flujos de trabajo.</p>
          </div>
          <div className="flex items-center gap-3 bg-slate-900/50 p-2 px-4 rounded-full border border-slate-800 h-10 shadow-lg">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             <span className="text-[10px] font-mono text-slate-300 uppercase tracking-widest">
                SYNC: {latency}ms
             </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Alertas #CIA" value={stats.totalErrors} icon={AlertTriangle} color="text-red-500" bg="bg-red-500/10" footer="Correcciones Detectadas" />
          <StatCard title="Identificados" value={stats.identifiedLeads} icon={UserCheck} color="text-green-500" bg="bg-green-500/10" footer={`de ${stats.totalLeads} prospectos`} />
          <StatCard title="Follow-ups" value={stats.activeFollowups} icon={RefreshCw} color="text-blue-500" bg="bg-blue-500/10" footer="Reintentos en cola" />
          <StatCard title="Versiones" value={stats.activeVersions} icon={Brain} color="text-purple-500" bg="bg-purple-500/10" footer="Iteraciones del Cerebro" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
             {/* Handoff Section */}
             {handoffs.length > 0 && (
                <Card className="bg-red-900/10 border-red-500/30 border-l-4 border-l-red-500">
                   <CardHeader className="py-3">
                      <CardTitle className="text-xs text-red-500 font-bold uppercase tracking-widest flex items-center gap-2">
                         <ShieldAlert className="w-4 h-4" /> Cola de Handoff (Urgente)
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="p-3 pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                         {handoffs.map(h => (
                            <div key={h.id} className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 flex justify-between items-center group cursor-pointer hover:border-red-500/50 transition-all">
                               <div>
                                  <p className="text-[10px] font-bold text-white truncate max-w-[100px]">{h.nombre || 'Desconocido'}</p>
                                  <p className="text-[9px] text-slate-500 font-mono mt-0.5">{new Date(h.last_message_at).toLocaleTimeString()}</p>
                               </div>
                               <ArrowRight className="w-3 h-3 text-slate-700 group-hover:text-red-500 group-hover:translate-x-1 transition-all" />
                            </div>
                         ))}
                      </div>
                   </CardContent>
                </Card>
             )}

             <Card className="bg-slate-900 border-slate-800 overflow-hidden shadow-2xl flex flex-col">
               <CardHeader className="border-b border-slate-800 bg-slate-950/30 flex flex-row items-center justify-between">
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                     <TrendingUp className="w-5 h-5 text-indigo-400" /> Curva de Precisión
                  </CardTitle>
                  <Badge className="bg-indigo-600">v0.8 AI Active</Badge>
               </CardHeader>
               <CardContent className="p-6 h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={chartData}>
                        <defs><linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} domain={[60, 100]} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} itemStyle={{ color: '#818cf8', fontWeight: 'bold' }} />
                        <Area type="monotone" dataKey="accuracy" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAcc)" />
                     </AreaChart>
                  </ResponsiveContainer>
               </CardContent>
             </Card>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MiniTable title="Live Feed" icon={MessageSquare} color="text-emerald-400" items={recentChats} />
                <MiniTable title="Próximas Acciones" icon={RefreshCw} color="text-blue-400" items={upcomingTasks} isTask />
             </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <SystemStatus />
            <Card className="bg-black border-slate-800 font-mono text-[10px] shadow-2xl flex flex-col rounded-xl overflow-hidden min-h-[400px]">
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
                 <div className="flex items-center gap-2 text-slate-500"><Terminal className="w-4 h-4" /><span className="font-bold uppercase tracking-tighter">Kernel Logs</span></div>
                 <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-red-500/40"></div><div className="w-2 h-2 rounded-full bg-yellow-500/40"></div><div className="w-2 h-2 rounded-full bg-green-500/40"></div></div>
              </div>
              <div className="p-4 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
                 {stats.recentLogs.map((log, i) => (
                    <div key={i} className="animate-in fade-in slide-in-from-left-2 duration-300 flex items-start gap-2">
                       <span className="text-slate-600 shrink-0">[{new Date(log.created_at).toLocaleTimeString()}]</span> 
                       <span className={`shrink-0 px-1 rounded ${log.action === 'ERROR' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>{log.action}</span> 
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
  <Card className="bg-slate-900 border-slate-800 p-6 hover:border-indigo-500/30 transition-all group">
    <div className="flex justify-between items-start">
      <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</p><h3 className="text-3xl font-bold text-white mt-2">{value}</h3></div>
      <div className={`p-3 rounded-xl ${bg} ${color} group-hover:rotate-12 transition-transform shadow-inner`}><Icon className="w-6 h-6" /></div>
    </div>
    <p className="mt-4 text-[9px] text-slate-600 font-mono uppercase tracking-tighter">{footer}</p>
  </Card>
);

const MiniTable = ({ title, icon: Icon, color, items, isTask }: any) => (
  <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
    <CardHeader className="border-b border-slate-800 py-3 bg-slate-950/20">
       <CardTitle className="text-white text-[10px] uppercase tracking-widest flex items-center gap-2"><Icon className={`w-4 h-4 ${color}`} /> {title}</CardTitle>
    </CardHeader>
    <CardContent className="p-0">
       <div className="divide-y divide-slate-800">
          {items.map((item: any) => (
             <div key={item.id} className="p-3 flex items-start gap-3 hover:bg-slate-800/50 transition-colors">
                <div className="flex-1 min-w-0">
                   <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[10px] font-bold text-slate-300 truncate">{item.nombre || item.leads?.nombre}</span>
                      <span className="text-[9px] text-slate-600 font-mono">{new Date(isTask ? item.next_followup_at : item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                   </div>
                   <p className="text-[11px] text-slate-500 line-clamp-1 italic">{isTask ? `Stage ${item.followup_stage}` : `"${item.mensaje}"`}</p>
                </div>
             </div>
          ))}
       </div>
    </CardContent>
  </Card>
);

export default Index;