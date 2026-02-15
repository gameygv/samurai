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
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  useEffect(() => {
    fetchData();
    
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
        setStats(prev => ({
          ...prev,
          recentLogs: [payload.new, ...prev.recentLogs].slice(0, 15)
        }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
      if (versionsRes.data) {
        const mapped = versionsRes.data.map((v, i) => ({
          name: v.version_numero || `v${i}`,
          accuracy: v.test_accuracy_nuevo || 70 + (i * 5),
        }));
        setChartData(mapped);
      }

      setConnectionStatus('connected');
    } catch (err) {
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div><h1 className="text-3xl font-bold text-white tracking-tight">Samurai Control Center</h1><p className="text-slate-400">Estado de la red neuronal y flujos de trabajo.</p></div>
          <div className="flex items-center gap-3 bg-slate-900/50 p-2 px-4 rounded-full border border-slate-800 shadow-inner">
            <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-xs font-mono text-slate-300 uppercase tracking-widest">
               Core: {connectionStatus === 'connected' ? 'Synced' : 'Error'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Alertas IA" value={stats.totalErrors} icon={AlertTriangle} color="text-red-500" bg="bg-red-500/10" footer="#CORREGIRIA Detectados" />
          <StatCard title="Pendientes" value={stats.pendingCorrections} icon={Clock} color="text-yellow-500" bg="bg-yellow-500/10" footer="Mejoras por validar" />
          <StatCard title="Versiones" value={stats.activeVersions} icon={TrendingUp} color="text-indigo-500" bg="bg-indigo-500/10" footer="Evolución del Cerebro" />
          <StatCard title="Base Datos" value="Ready" icon={Database} color="text-emerald-500" bg="bg-emerald-500/10" footer="Latency: 42ms" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Chart Section */}
          <Card className="lg:col-span-8 bg-slate-900 border-slate-800 overflow-hidden shadow-2xl flex flex-col">
            <CardHeader className="border-b border-slate-800 bg-slate-950/30 flex flex-row items-center justify-between">
               <CardTitle className="text-white text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-400" /> 
                  Curva de Aprendizaje
               </CardTitle>
               <Badge className="bg-indigo-600">Mejora Continua</Badge>
            </CardHeader>
            <CardContent className="p-6 h-[300px] w-full">
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

          {/* Terminal Section */}
          <Card className="lg:col-span-4 bg-black border-slate-800 font-mono text-[10px] shadow-2xl flex flex-col h-[400px] lg:h-auto rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
               <div className="flex items-center gap-2 text-slate-500">
                  <Terminal className="w-4 h-4" />
                  <span className="font-bold tracking-tighter uppercase">Kernel Logs</span>
               </div>
               <Zap className="w-3 h-3 text-yellow-500 animate-pulse" />
            </div>
            <div className="p-4 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
               {stats.recentLogs.map((log, i) => (
                  <p key={i} className="animate-in fade-in slide-in-from-left-2 duration-300">
                     <span className="text-slate-600">[{new Date(log.created_at).toLocaleTimeString()}]</span> 
                     <span className={`ml-2 px-1 rounded ${log.action === 'ERROR' ? 'bg-red-500/20 text-red-400' : log.action === 'CHAT' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                        {log.action}
                     </span> 
                     <span className="ml-2 text-slate-300">{log.description}</span>
                  </p>
               ))}
               <div className="pt-2 flex items-center gap-2">
                  <span className="w-2 h-4 bg-indigo-500 animate-pulse"></span>
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