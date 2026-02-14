import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Database, Shield, Activity, Terminal, AlertTriangle, 
  CheckCircle2, MessageSquare, TrendingUp, Clock, Loader2 
} from 'lucide-react';
import { toast } from 'sonner';

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
    const checkConnectionAndFetchStats = async () => {
      const start = performance.now();
      try {
        // Health check
        const { error: authError } = await supabase.auth.getSession();
        if (authError) throw authError;
        
        const end = performance.now();
        setLatency(Math.round(end - start));
        setConnectionStatus('connected');

        // Fetch Stats parallel
        const [errorsRes, pendingRes, versionsRes, logsRes] = await Promise.all([
          supabase.from('errores_ia').select('count', { count: 'exact', head: true }),
          supabase.from('errores_ia').select('count', { count: 'exact', head: true }).eq('estado_correccion', 'REPORTADA'),
          supabase.from('versiones_prompts_aprendidas').select('count', { count: 'exact', head: true }),
          supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(5)
        ]);

        setStats({
          totalErrors: errorsRes.count || 0,
          pendingCorrections: pendingRes.count || 0,
          activeVersions: versionsRes.count || 0,
          recentLogs: logsRes.data || []
        });

      } catch (err: any) {
        console.error('Error in Dashboard:', err);
        setConnectionStatus('error');
      } finally {
        setLoading(false);
      }
    };

    checkConnectionAndFetchStats();
  }, []);

  return (
    <Layout>
      <div className="space-y-8 pb-12">
        
        {/* Header con Estado de Conexión */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard del Samurai</h1>
            <p className="text-slate-400">Visión global de aprendizaje y salud del sistema.</p>
          </div>
          <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-lg border border-slate-800">
            <span className="text-xs font-mono text-slate-500">API STATUS:</span>
            {connectionStatus === 'connected' ? (
               <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 px-2 py-0">
                  ONLINE ({latency}ms)
               </Badge>
            ) : connectionStatus === 'error' ? (
               <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 px-2 py-0">OFFLINE</Badge>
            ) : (
               <div className="flex items-center gap-1 text-xs text-yellow-500">
                  <Loader2 className="w-3 h-3 animate-spin" /> Verificando...
               </div>
            )}
          </div>
        </div>

        {/* Métrica Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Errores IA" 
            value={stats.totalErrors} 
            icon={AlertTriangle} 
            color="text-red-500" 
            bg="bg-red-500/10"
            footer="Total reportados (#CORREGIRIA)"
          />
          <StatCard 
            title="Pendientes" 
            value={stats.pendingCorrections} 
            icon={Clock} 
            color="text-yellow-500" 
            bg="bg-yellow-500/10"
            footer="Esperando validación"
          />
          <StatCard 
            title="Versiones" 
            value={stats.activeVersions} 
            icon={TrendingUp} 
            color="text-indigo-500" 
            bg="bg-indigo-500/10"
            footer="Iteraciones del Cerebro"
          />
          <StatCard 
            title="Base Datos" 
            value="Activa" 
            icon={Database} 
            color="text-green-500" 
            bg="bg-green-500/10"
            footer="Supabase Instance OK"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Recent Activity Feed */}
          <Card className="lg:col-span-2 bg-slate-900 border-slate-800 shadow-xl">
            <CardHeader className="border-b border-slate-800">
               <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-400" />
                  Actividad Reciente del Sistema
               </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y divide-slate-800">
                  {loading ? (
                    <div className="p-8 text-center text-slate-500">
                       <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                       Cargando actividad...
                    </div>
                  ) : stats.recentLogs.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 font-mono text-sm">
                       [NO RECENT LOGS FOUND]
                    </div>
                  ) : (
                    stats.recentLogs.map((log) => (
                      <div key={log.id} className="p-4 hover:bg-slate-800/30 transition-colors flex items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className={`p-2 rounded bg-slate-800 ${log.action === 'ERROR' ? 'text-red-400' : 'text-slate-400'}`}>
                             {log.action === 'LOGIN' ? <Shield className="w-4 h-4" /> : 
                              log.action === 'UPDATE' ? <Activity className="w-4 h-4" /> : 
                              <Terminal className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-sm text-slate-200 font-medium">{log.description}</p>
                            <p className="text-xs text-slate-500 font-mono mt-1">
                               {log.username} • {new Date(log.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="border-slate-700 text-[10px] text-slate-500 uppercase tracking-tighter">
                           {log.resource}
                        </Badge>
                      </div>
                    ))
                  )}
               </div>
            </CardContent>
          </Card>

          {/* Quick Status / Terminal */}
          <Card className="bg-black/60 border-slate-800 font-mono text-xs text-slate-400 shadow-2xl flex flex-col h-full min-h-[400px]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/50 text-slate-500">
              <Terminal className="w-4 h-4" />
              <span className="font-bold tracking-widest uppercase">Samurai OS Terminal</span>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
              <p><span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span> <span className="text-green-500">INIT</span> Kernel v5.2 sequence started...</p>
              <p><span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span> <span className="text-blue-500">LINK</span> Connected to Supabase Cluster giwoo...</p>
              <p><span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span> <span className="text-purple-500">INFO</span> Loading prompts from brain_v2...</p>
              <p><span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span> <span className="text-yellow-500">WARN</span> Ojo de Halcón waiting for bank image hooks.</p>
              <p className="pt-2 animate-pulse text-indigo-400">_ SYSTEM READY. WAITING FOR COMMANDS...</p>
              
              <div className="mt-8 border-t border-slate-800 pt-4">
                 <p className="text-slate-500 underline mb-2">Resumen de Capas:</p>
                 <div className="grid grid-cols-2 gap-2">
                    <div className="flex justify-between">
                       <span>Capa Visual:</span> <span className="text-green-500">OK</span>
                    </div>
                    <div className="flex justify-between">
                       <span>Capa Lógica:</span> <span className="text-green-500">OK</span>
                    </div>
                    <div className="flex justify-between">
                       <span>Capa Datos:</span> <span className="text-green-500">OK</span>
                    </div>
                    <div className="flex justify-between">
                       <span>IA Learn:</span> <span className="text-yellow-500">IDLE</span>
                    </div>
                 </div>
              </div>
            </div>
          </Card>

        </div>

      </div>
    </Layout>
  );
};

// Sub-componente para tarjetas de estadísticas
const StatCard = ({ title, value, icon: Icon, color, bg, footer }: any) => (
  <Card className="bg-slate-900 border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition-all duration-300 group shadow-lg">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{title}</p>
        <h3 className="text-3xl font-bold text-white mt-2 group-hover:scale-110 transition-transform origin-left">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl ${bg} ${color} group-hover:rotate-12 transition-transform`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
    <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500 font-mono">
      <div className={`w-1.5 h-1.5 rounded-full ${color.replace('text', 'bg')}`}></div>
      <span>{footer}</span>
    </div>
  </Card>
);

export default Index;