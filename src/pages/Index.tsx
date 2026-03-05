import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SystemStatus } from '@/components/SystemStatus';
import { BrainHealthCard } from '@/components/dashboard/BrainHealthCard';
import { TaskRadar } from '@/components/dashboard/TaskRadar';
import { cn } from '@/lib/utils';
import { 
  Database, Shield, Activity, Terminal, AlertTriangle, 
  CheckCircle2, MessageSquare, TrendingUp, Clock, Loader2,
  Zap, Brain, RefreshCw, Send, ArrowRight, UserCheck, ShieldAlert, BarChart3, Users2, DollarSign, Globe, Eye, Image as ImageIcon, Settings as SettingsIcon, Fingerprint, Trello
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip } from 'recharts';

const Index = () => {
  const [stats, setStats] = useState({
    totalErrors: 0,
    pendingCorrections: 0,
    activeVersions: 0,
    recentLogs: [] as any[],
    activeFollowups: 0,
    identifiedLeads: 0,
    totalLeads: 0,
    validatedSales: 0,
    capiReadyLeads: 0
  });
  
  const [brainHealth, setBrainHealth] = useState({
    adnCoreStatus: 'missing' as 'ok' | 'missing',
    ciaRules: 0,
    webHealth: 0,
    overallStatus: 'Sync Required' as 'Operational' | 'Degraded' | 'Sync Required'
  });

  const [upcomingTasks, setUpcomingTasks] = useState<any[]>([]);
  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const start = performance.now();
      
      const [
        errorsRes, 
        pendingRes, 
        versionsRes, 
        logsRes, 
        followupsRes, 
        leadsRes, 
        webRes, 
        validatedCiaRes, 
        adnPromptRes,
        salesRes
      ] = await Promise.all([
        supabase.from('errores_ia').select('count', { count: 'exact', head: true }),
        supabase.from('errores_ia').select('count', { count: 'exact', head: true }).eq('estado_correccion', 'REPORTADA'),
        supabase.from('versiones_prompts_aprendidas').select('*').order('created_at', { ascending: true }),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(15),
        supabase.from('leads').select('id, nombre, next_followup_at').not('next_followup_at', 'is', null).order('next_followup_at', { ascending: true }).limit(5),
        supabase.from('leads').select('*'),
        supabase.from('main_website_content').select('scrape_status'),
        supabase.from('errores_ia').select('count', { count: 'exact', head: true }).eq('estado_correccion', 'VALIDADA'),
        supabase.from('app_config').select('key').eq('key', 'prompt_adn_core').limit(1).maybeSingle(),
        supabase.from('activity_logs').select('count', { count: 'exact', head: true }).like('description', '%Venta CERRADA%')
      ]);

      const end = performance.now();
      setLatency(Math.round(end - start));

      const leads = leadsRes.data || [];
      const identified = leads.filter(l => l.nombre && !l.nombre.includes('Nuevo Lead')).length;
      const capiReady = leads.filter(l => (l.nombre && !l.nombre.includes('Nuevo Lead')) && (l.email && l.email.length > 5)).length;
      
      const webPages = webRes.data || [];
      const healthyPages = webPages.filter(p => p.scrape_status === 'success').length;
      const webHealth = webPages.length > 0 ? Math.round((healthyPages / webPages.length) * 100) : 0;

      setBrainHealth({ 
        adnCoreStatus: adnPromptRes.data ? 'ok' : 'missing', 
        ciaRules: validatedCiaRes.count || 0, 
        webHealth, 
        overallStatus: (webHealth < 50 || !adnPromptRes.data) ? 'Sync Required' : (webHealth < 80 ? 'Degraded' : 'Operational') 
      });

      const tasks = (followupsRes.data || []).map(f => ({
        id: f.id,
        type: 'FOLLOWUP',
        target: f.nombre || 'Lead Desconocido',
        time: new Date(f.next_followup_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'scheduled'
      }));
      setUpcomingTasks(tasks);

      // Usando paleta dorada elegante para el embudo
      setFunnelData([
        { name: 'Prospectos', value: leads.length, color: '#A48E75' },
        { name: 'Identificados', value: identified, color: '#BCAB94' },
        { name: 'Listos CAPI', value: capiReady, color: '#D4AF37' },
        { name: 'Cierre Hot', value: leads.filter(l => l.buying_intent === 'ALTO').length, color: '#B48B25' }
      ]);

      setStats({
        totalErrors: errorsRes.count || 0,
        pendingCorrections: pendingRes.count || 0,
        activeVersions: (versionsRes.data || []).length,
        recentLogs: logsRes.data || [],
        activeFollowups: followupsRes.count || 0,
        identifiedLeads: identified,
        totalLeads: leads.length,
        validatedSales: salesRes.count || 0,
        capiReadyLeads: capiReady
      });

    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-amber-600" /></div></Layout>;

  return (
    <Layout>
      <div className="space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-50 tracking-tight flex items-center gap-4">
               <div className="w-12 h-12 flex items-center justify-center shadow-2xl shrink-0 bg-slate-900 rounded-xl p-2 border border-slate-800">
                  <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
               </div>
               The Elephant Bowl Hub
            </h1>
            <p className="text-slate-400 text-sm mt-1">Operaciones Tácticas & Inteligencia de Datos</p>
          </div>
          <div className="flex items-center gap-3 bg-slate-900 p-2 px-4 rounded-full border border-slate-800 h-10 shadow-lg">
             <div className={`w-2 h-2 rounded-full animate-pulse ${latency !== null ? 'bg-amber-500' : 'bg-red-400'}`}></div>
             <span className="text-[10px] font-mono text-slate-300 uppercase tracking-widest font-bold">
                {latency !== null ? `KERNEL: ONLINE | LATENCY: ${latency}ms` : 'KERNEL: RECONNECTING...'}
             </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Salud Meta CAPI" value={`${stats.totalLeads > 0 ? Math.round((stats.capiReadyLeads / stats.totalLeads) * 100) : 0}%`} icon={Fingerprint} color="text-amber-500" bg="bg-amber-500/10" footer={`${stats.capiReadyLeads} Leads con Datos Full`} />
          <StatCard title="Alertas #CIA" value={stats.totalErrors} icon={AlertTriangle} color="text-orange-400" bg="bg-orange-500/10" footer="Mejoras de Conducta" />
          <StatCard title="Ventas Validadas" value={stats.validatedSales} icon={DollarSign} color="text-amber-400" bg="bg-amber-400/10" footer="Reservas Confirmadas" />
          <StatCard title="Total Prospectos" value={stats.totalLeads} icon={Users2} color="text-slate-400" bg="bg-slate-700/50" footer="Tráfico Acumulado" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="bg-slate-900 border-slate-800 flex flex-col shadow-2xl rounded-2xl">
                  <CardHeader className="py-4 border-b border-slate-800">
                     <CardTitle className="text-slate-200 text-xs flex items-center gap-2 uppercase tracking-widest font-bold">
                        <BarChart3 className="w-4 h-4 text-amber-500" /> Pipeline de Conversión (CAPI)
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 h-[250px]">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={funnelData} layout="vertical" margin={{ left: 20 }}>
                           <XAxis type="number" hide />
                           <YAxis dataKey="name" type="category" stroke="#D5C9B8" fontSize={10} width={100} />
                           <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#1A1714', border: '1px solid #3D3730', borderRadius: '8px', fontSize: '10px', color: '#FDFBF7' }} />
                           <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={25}>
                              {funnelData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                           </Bar>
                        </BarChart>
                     </ResponsiveContainer>
                  </CardContent>
                </Card>

                <TaskRadar tasks={upcomingTasks} />
             </div>

             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <QuickButton label="Probar IA" path="/brain?tab=simulador" icon={Zap} color="bg-indigo-900/30 text-amber-500 border-indigo-900/50" />
                <QuickButton label="Radar Leads" path="/leads" icon={MessageSquare} color="bg-slate-800/50 text-slate-300 border-slate-700" />
                <QuickButton label="Media Manager" path="/media" icon={ImageIcon} color="bg-slate-800/50 text-slate-300 border-slate-700" />
                <QuickButton label="Monitor Live" path="/activity" icon={Activity} color="bg-slate-800/50 text-slate-300 border-slate-700" />
             </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <SystemStatus />
            <BrainHealthCard health={brainHealth} />
            
            <Card className="bg-[#1A1714] border-slate-800 font-mono text-[9px] shadow-2xl flex flex-col rounded-2xl overflow-hidden h-[300px]">
              <div className="px-4 py-3 border-b border-slate-800 bg-[#292520] flex items-center justify-center">
                 <div className="flex items-center gap-2 text-slate-400"><Terminal className="w-3.5 h-3.5" /><span className="font-bold uppercase tracking-widest">Live Activity Log</span></div>
              </div>
              <ScrollArea className="flex-1 p-4">
                 <div className="space-y-1.5">
                    {stats.recentLogs.map((log, i) => (
                        <div key={i} className="flex items-start gap-2 border-l border-slate-700 pl-2 group">
                          <span className="text-slate-500 shrink-0">[{new Date(log.created_at).toLocaleTimeString([], { hour12: false })}]</span> 
                          <span className={cn(
                              "shrink-0 px-1 rounded uppercase font-bold",
                              log.action === 'ERROR' ? 'bg-red-900/30 text-red-400' : 
                              log.action === 'CREATE' ? 'bg-amber-900/30 text-amber-500' :
                              'bg-indigo-900/50 text-indigo-300'
                          )}>{log.action}</span> 
                          <span className="text-slate-300 truncate max-w-[200px] group-hover:text-amber-100 transition-colors">{log.description}</span>
                        </div>
                    ))}
                 </div>
              </ScrollArea>
              <div className="p-2 bg-slate-900/50 border-t border-slate-800 text-center">
                 <button onClick={() => window.location.href='/activity'} className="text-[8px] text-slate-500 hover:text-amber-500 uppercase font-bold tracking-widest transition-colors">Ver Monitor en Vivo</button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

const QuickButton = ({ label, path, icon: Icon, color }: any) => (
   <Button 
     variant="outline" 
     className={cn("flex flex-col h-20 gap-2 items-center justify-center border transition-all hover:scale-105 active:scale-95 rounded-xl shadow-lg", color)} 
     onClick={() => window.location.href = path}
   >
      <Icon className="w-5 h-5" />
      <span className="text-[9px] uppercase font-bold tracking-widest">{label}</span>
   </Button>
);

const StatCard = ({ title, value, icon: Icon, color, bg, footer }: any) => (
  <Card className="bg-slate-900 border-slate-800 p-6 hover:border-slate-700 transition-all group shadow-xl rounded-2xl">
    <div className="flex justify-between items-start">
      <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p><h3 className="text-3xl font-bold text-slate-50 mt-2">{value}</h3></div>
      <div className={cn("p-3 rounded-xl shadow-inner", bg, color, "group-hover:scale-110 transition-transform")}><Icon className="w-6 h-6" /></div>
    </div>
    <p className="mt-4 text-[9px] text-slate-500 font-mono uppercase tracking-widest">{footer}</p>
  </Card>
);

export default Index;