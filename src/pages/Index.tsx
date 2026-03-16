import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { StatCard } from '@/components/dashboard/StatCard';
import { SystemStatus } from '@/components/SystemStatus';
import { BrainHealthCard } from '@/components/dashboard/BrainHealthCard';
import { TaskRadar } from '@/components/dashboard/TaskRadar';
import { CheckCircle2, DollarSign, Users2, Fingerprint, Terminal, Loader2, Zap } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const Index = () => {
  const { user, isAdmin, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({ totalLeads: 0, wonSales: 0, capiReady: 0, recentLogs: [] });

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchData = async () => {
    const { data: leads } = await supabase.from('leads').select('*');
    const { data: logs } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(10);
    
    if (leads) {
      setStats({
        totalLeads: leads.length,
        wonSales: leads.filter(l => l.buying_intent === 'COMPRADO').length,
        capiReady: leads.filter(l => l.email && l.email.includes('@')).length,
        recentLogs: logs || []
      });
    }
    setLoading(false);
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-indigo-500" /></div>;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">System Console <span className="text-indigo-500">v2.0</span></h1>
            <p className="text-slate-500 text-sm mt-1">Status: Operational | User: {profile?.full_name}</p>
          </div>
          <div className="flex items-center gap-3 bg-slate-900/50 p-2 px-4 rounded-full border border-slate-800 border-l-4 border-l-indigo-500 shadow-glow">
             <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
             <span className="text-[10px] font-mono font-bold uppercase tracking-widest">Kernel Synced</span>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Ventas" value={stats.wonSales} icon={CheckCircle2} footer="Ganadas" color="text-emerald-400" delay={0.1} />
          <StatCard title="Revenue" value={`$${stats.wonSales * 1500}`} icon={DollarSign} footer="Estimado" color="text-amber-500" delay={0.2} />
          <StatCard title="Cartera" value={stats.totalLeads} icon={Users2} footer="Prospectos" color="text-indigo-400" delay={0.3} />
          <StatCard title="Match CAPI" value={stats.capiReady} icon={Fingerprint} footer="Datos Full" color="text-blue-400" delay={0.4} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <TaskRadar tasks={[]} />
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-tactical">
              <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-500" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Live Mission Logs</span>
              </div>
              <ScrollArea className="h-64 p-4 font-mono text-[10px]">
                {stats.recentLogs.map((log: any, i: number) => (
                  <div key={i} className="flex gap-4 py-1.5 border-l border-slate-800 pl-4 mb-2 hover:bg-slate-800/30 rounded transition-colors group">
                    <span className="text-slate-600 group-hover:text-indigo-400">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                    <span className="text-indigo-300 uppercase font-bold">{log.action}</span>
                    <span className="text-slate-400">{log.description}</span>
                  </div>
                ))}
              </ScrollArea>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <SystemStatus />
            <BrainHealthCard health={{ adnCoreStatus: 'ok', ciaRules: 5, webHealth: 95, overallStatus: 'Operational' }} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Index;