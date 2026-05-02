import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { StatCard } from '@/components/dashboard/StatCard';
import { SystemStatus } from '@/components/SystemStatus';
import { BrainHealthCard } from '@/components/dashboard/BrainHealthCard';
import { TaskRadar } from '@/components/dashboard/TaskRadar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, DollarSign, Users2, Fingerprint, Terminal, Loader2, Zap, Activity, TrendingUp } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

const Index = () => {
  const { user, profile, isManager } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({
     totalLeads: 0, wonSales: 0, capiReady: 0, recentLogs: [], tasks: []
  });
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [user, isManager]);

  const fetchData = async () => {
    let leadsQuery = supabase.from('leads').select('id, created_at, reminders, nombre, telefono, buying_intent, email, assigned_to', { count: 'exact' });
    if (!isManager) leadsQuery = leadsQuery.eq('assigned_to', user?.id);
    const { data: leads, count: leadsCount } = await leadsQuery;
    const { data: logs } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(20);
    
    // Buscar Campañas Programadas para el Radar
    const { data: campaignsConfig } = await supabase.from('app_config').select('value').eq('key', 'scheduled_campaigns').maybeSingle();

    if (leads) {
      const allTasks: any[] = [];
      const dailyCounts: Record<string, number> = {};
      
      for(let i=6; i>=0; i--) {
         const d = new Date();
         d.setDate(d.getDate() - i);
         dailyCounts[d.toISOString().split('T')[0]] = 0;
      }

      leads.forEach(l => {
         const leadDate = l.created_at ? l.created_at.split('T')[0] : null;
         if (leadDate && dailyCounts[leadDate] !== undefined) {
             dailyCounts[leadDate]++;
         }

         if (l.reminders && Array.isArray(l.reminders)) {
            l.reminders.forEach((r: any) => {
               if (r.datetime) {
                  const remDate = new Date(r.datetime);
                  const now = new Date();
                  allTasks.push({
                     id: r.id, target: l.nombre || l.telefono,
                     time: remDate.toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
                     type: remDate < now ? 'ATRASADO' : 'PROGRAMADO', status: 'pending', rawDate: remDate, rawLead: l
                  });
               }
            });
         }
      });

      // Inyectar Campañas Programadas en el radar de tareas
      if (campaignsConfig?.value) {
         try {
             const campaigns = JSON.parse(campaignsConfig.value);
             campaigns.forEach((camp: any) => {
                 if (camp.status === 'pending' || camp.status === 'processing') {
                     const remDate = new Date(camp.scheduledAt);
                     allTasks.push({
                         id: camp.id,
                         target: `${camp.name}`,
                         time: remDate.toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
                         type: 'CAMPAÑA',
                         status: camp.status,
                         rawDate: remDate,
                         rawLead: null
                     });
                 }
             });
         } catch(e) {}
      }

      const formattedChartData = Object.keys(dailyCounts).map(date => ({
         name: new Date(date).toLocaleDateString('es-ES', { weekday: 'short' }),
         Leads: dailyCounts[date]
      }));

      // Ordenar tareas por fecha
      allTasks.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

      setChartData(formattedChartData);
      setStats({
        totalLeads: leadsCount ?? leads.length,
        wonSales: leads.filter(l => l.buying_intent === 'COMPRADO').length,
        capiReady: leads.filter(l => l.email && l.email.includes('@')).length,
        recentLogs: logs || [],
        tasks: allTasks.slice(0, 10),
      });
    }
    setLoading(false);
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-white dark:bg-[#050505]"><Loader2 className="animate-spin text-indigo-500" /></div>;

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto space-y-8 pb-12 animate-in fade-in duration-500">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#0a0a0c] p-6 rounded-3xl border border-slate-200 dark:border-[#1a1a1a] shadow-lg dark:shadow-2xl">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
               Dashboard <Badge className="bg-indigo-600 hover:bg-indigo-600 text-white border-none shadow-lg">v2.5 Pro</Badge>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Status: Operational | User: {profile?.full_name}</p>
          </div>
          <div className="flex items-center gap-3 bg-amber-50 dark:bg-[#121214] p-2.5 px-5 rounded-xl border border-amber-200 dark:border-[#222225] border-l-4 border-l-amber-500 shadow-md dark:shadow-xl">
             <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.8)]"></div>
             <span className="text-[11px] text-amber-600 dark:text-amber-500 font-mono font-bold uppercase tracking-widest">Kernel Synced</span>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Ventas" value={stats.wonSales} icon={CheckCircle2} footer="Negocios Cerrados" color="text-emerald-400" delay={0.1} />
          <StatCard title="Revenue" value={`$${(stats.wonSales * 1500).toLocaleString()}`} icon={DollarSign} footer="Ingreso Estimado" color="text-amber-500" delay={0.2} />
          <StatCard title="Cartera" value={stats.totalLeads} icon={Users2} footer="Prospectos Activos" color="text-indigo-400" delay={0.3} />
          <StatCard title="Match CAPI" value={stats.capiReady} icon={Fingerprint} footer="Datos Enriquecidos" color="text-blue-400" delay={0.4} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-8 space-y-8">
            <Card className="bg-white dark:bg-[#0a0a0c] border-slate-200 dark:border-[#1a1a1a] shadow-lg dark:shadow-2xl rounded-3xl overflow-hidden">
               <CardHeader className="border-b border-slate-200 dark:border-[#1a1a1a] bg-slate-50 dark:bg-[#0f0f11]/50">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300 flex items-center gap-2">
                     <TrendingUp className="w-4 h-4 text-indigo-500 dark:text-indigo-400"/> Flujo de Ingreso de Leads (7 Días)
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-0">
                  <ScrollArea className="w-full">
                     <div className="min-w-[600px] h-[300px] p-6 pr-8">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="[&>line]:stroke-slate-200 dark:[&>line]:stroke-gray-800" stroke="#1f2937" vertical={false} />
                            <XAxis dataKey="name" className="[&>g>text]:fill-slate-500 dark:[&>g>text]:fill-slate-500" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis className="[&>g>text]:fill-slate-500 dark:[&>g>text]:fill-slate-500" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                            <RechartsTooltip
                              contentStyle={{ backgroundColor: 'var(--tooltip-bg, #0f0f11)', borderColor: 'var(--tooltip-border, #1f2937)', borderRadius: '12px', color: 'var(--tooltip-color, #f8fafc)', fontSize: '12px' }}
                              itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                            />
                            <Area type="monotone" dataKey="Leads" stroke="#818cf8" strokeWidth={3} fillOpacity={1} fill="url(#colorLeads)" />
                          </AreaChart>
                        </ResponsiveContainer>
                     </div>
                     <ScrollBar orientation="horizontal" className="bg-slate-100 dark:bg-[#121214]" />
                  </ScrollArea>
               </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <TaskRadar tasks={stats.tasks} />
               
               <div className="bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-[#1a1a1a] rounded-3xl overflow-hidden shadow-lg dark:shadow-2xl flex flex-col h-[250px]">
                 <div className="p-4 bg-slate-50 dark:bg-[#0f0f11] border-b border-slate-200 dark:border-[#1a1a1a] flex items-center gap-2 shrink-0">
                   <Terminal className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                   <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Live Mission Logs</span>
                 </div>
                 <ScrollArea className="flex-1 p-4 font-mono text-[10px] bg-slate-50 dark:bg-[#050505]">
                   {stats.recentLogs.map((log: any, i: number) => (
                     <div key={i} className={cn("flex gap-4 py-2 border-l-2 border-slate-200 dark:border-[#1a1a1a] pl-3 mb-2 rounded-r-lg transition-all group cursor-default", log.action === 'ERROR' ? "hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-950/20" : "hover:border-indigo-500 hover:bg-slate-100 dark:hover:bg-[#0f0f11]")}>
                       <span className="text-slate-400 dark:text-slate-600 shrink-0">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                       <span className={cn("uppercase font-bold shrink-0", log.action === 'ERROR' ? "text-red-500" : "text-indigo-600 dark:text-indigo-400")}>{log.action}</span>
                       <span className={cn("truncate", log.action === 'ERROR' ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-400")}>{log.description}</span>
                     </div>
                   ))}
                 </ScrollArea>
               </div>
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