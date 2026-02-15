import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Database, Shield, Activity, Terminal, AlertTriangle, 
  CheckCircle2, MessageSquare, TrendingUp, Clock, Loader2 
} from 'lucide-react';

const Index = () => {
  const [stats, setStats] = useState({
    totalErrors: 0,
    pendingCorrections: 0,
    activeVersions: 0,
    recentLogs: [] as any[]
  });
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    checkConnectionAndFetchStats();
  }, []);

  const checkConnectionAndFetchStats = async () => {
    const start = performance.now();
    try {
      const { error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      
      const end = performance.now();
      setLatency(Math.round(end - start));
      setConnectionStatus('connected');

      const [errorsRes, pendingRes, versionsRes, logsRes] = await Promise.all([
        supabase.from('errores_ia').select('count', { count: 'exact', head: true }),
        supabase.from('errores_ia').select('count', { count: 'exact', head: true }).eq('estado_correccion', 'REPORTADA'),
        supabase.from('versiones_prompts_aprendidas').select('count', { count: 'exact', head: true }),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(10)
      ]);

      setStats({
        totalErrors: errorsRes.count || 0,
        pendingCorrections: pendingRes.count || 0,
        activeVersions: versionsRes.count || 0,
        recentLogs: logsRes.data || []
      });

    } catch (err: any) {
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div><h1 className="text-3xl font-bold text-white">Dashboard del Samurai</h1><p className="text-slate-400">Estado real del sistema v0.801.</p></div>
          <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-lg border border-slate-800">
            <span className="text-xs font-mono text-slate-500">API:</span>
            <Badge variant="outline" className={connectionStatus === 'connected' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}>
               {connectionStatus === 'connected' ? `ONLINE (${latency}ms)` : 'OFFLINE'}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard title="Errores IA" value={stats.totalErrors} icon={AlertTriangle} color="text-red-500" bg="bg-red-500/10" footer="Total #CORREGIRIA" />
          <StatCard title="Pendientes" value={stats.pendingCorrections} icon={Clock} color="text-yellow-500" bg="bg-yellow-500/10" footer="Esperando validación" />
          <StatCard title="Versiones" value={stats.activeVersions} icon={TrendingUp} color="text-indigo-500" bg="bg-indigo-500/10" footer="Iteraciones del Cerebro" />
          <StatCard title="Base Datos" value="Activa" icon={Database} color="text-green-500" bg="bg-green-500/10" footer="Supabase Instance OK" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 bg-slate-900 border-slate-800 overflow-hidden">
            <CardHeader className="border-b border-slate-800"><CardTitle className="text-white text-lg flex items-center gap-2"><Activity className="w-5 h-5 text-indigo-400" /> Actividad Reciente</CardTitle></CardHeader>
            <CardContent className="p-0 divide-y divide-slate-800">
               {stats.recentLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-slate-800/30 flex items-center justify-between">
                     <div className="flex gap-4">
                        <div className="p-2 bg-slate-800 rounded text-slate-400"><Terminal className="w-4 h-4" /></div>
                        <div><p className="text-sm text-slate-200">{log.description}</p><p className="text-xs text-slate-500">{log.username} • {new Date(log.created_at).toLocaleTimeString()}</p></div>
                     </div>
                     <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-500">{log.resource}</Badge>
                  </div>
               ))}
            </CardContent>
          </Card>

          <Card className="bg-black/80 border-slate-800 font-mono text-[10px] text-slate-400 shadow-2xl flex flex-col h-full min-h-[400px]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900 text-slate-500"><Terminal className="w-4 h-4" /><span>SAMURAI OS TERMINAL</span></div>
            <div className="p-4 space-y-1.5 overflow-y-auto flex-1 custom-scrollbar">
               {stats.recentLogs.slice(0, 15).map((log, i) => (
                  <p key={i}><span className="text-slate-600">[{new Date(log.created_at).toLocaleTimeString()}]</span> <span className={log.action === 'ERROR' ? 'text-red-500' : 'text-green-500'}>{log.action}</span> {log.description}</p>
               ))}
               <p className="pt-2 animate-pulse text-indigo-400">_ AGENTE EN LÍNEA. ESPERANDO COMANDOS...</p>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

const StatCard = ({ title, value, icon: Icon, color, bg, footer }: any) => (
  <Card className="bg-slate-900 border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition-all duration-300 group">
    <div className="flex justify-between items-start">
      <div><p className="text-xs font-semibold text-slate-500 uppercase">{title}</p><h3 className="text-3xl font-bold text-white mt-2 group-hover:scale-105 transition-transform origin-left">{value}</h3></div>
      <div className={`p-3 rounded-xl ${bg} ${color}`}><Icon className="w-6 h-6" /></div>
    </div>
    <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500 font-mono"><div className={`w-1.5 h-1.5 rounded-full ${color.replace('text', 'bg')}`}></div><span>{footer}</span></div>
  </Card>
);

export default Index;