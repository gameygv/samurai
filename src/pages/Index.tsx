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
  Zap, Brain, RefreshCw, Send, ArrowRight, UserCheck, ShieldAlert, BarChart3, Users2, DollarSign, Globe, Eye, Image as ImageIcon, Settings as SettingsIcon, Fingerprint
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip } from 'recharts';
import { toast } from 'sonner';

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

  const [tasks, setTasks] = useState<any[]>([]);
  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [latency, setLatency] = useState<number>(0);

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
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('leads').select('id, nombre, next_followup_at').not('next_followup_at', 'is', null).order('next_followup_at', { ascending: true }).limit(5),
        supabase.from('leads').select('*'),
        supabase.from('main_website_content').select('scrape_status'),
        supabase.from('errores_ia').select('count', { count: 'exact', head: true }).eq('estado_correccion', 'VALIDADA'),
        supabase.from('app_config').select('key').eq('key', 'prompt_adn_core').limit(1).maybeSingle(),
        supabase.from('activity_logs').select('count', { count: 'exact', head: true }).like('description', '%Pago VALIDADO%')
      ]);

      const end = performance.now();
      setLatency(Math.round(end - start));

      const leads = leadsRes.data || [];
      const identified = leads.filter(l => l.nombre && !l.nombre.includes('Nuevo Lead')).length;
      
      // Métrica Core: CAPI Health (Tiene nombre Y email)
      const capiReady = leads.filter(l => (l.nombre && !l.nombre.includes('Nuevo Lead')) && (l.email && l.email.length > 5)).length;
      
      const webPages = webRes.data || [];
      const healthyPages = webPages.filter(p => p.scrape_status === 'success').length;
      const webHealth = webPages.length > 0 ? Math.round((healthyPages / webPages.length) * 100) : 0;

      const adnCoreStatus = adnPromptRes.data ? 'ok' : 'missing';
      const ciaRules = validatedCiaRes.count || 0;
      let overallStatus: 'Operational' | 'Degraded' | 'Sync Required' = 'Operational';
      if (webHealth < 50 || adnCoreStatus === 'missing') overallStatus = 'Sync Required';
      else if (webHealth < 80) overallStatus = 'Degraded';

      setBrainHealth({ adnCoreStatus, ciaRules, webHealth, overallStatus });

      setFunnelData([
        { name: 'Prospectos', value: leads.length, color: '#6366f1' },
        { name: 'Identificados', value: identified, color: '#818cf8' },
        { name: 'Listos CAPI', value: capiReady, color: '#c084fc' },
        { name: 'Cierre Hot', value: leads.filter(l => l.buying_intent === 'ALTO').length, color: '#f43f5e' }
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

      const { data: chats } = await supabase.from('conversaciones').select('*, leads(nombre)').order('created_at', { ascending: false }).limit(6);
      if (chats) setRecentChats(chats);

    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div></Layout>;

  return (
    <Layout>
      <div className="space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
               <div className="w-8 h-8 rounded bg-red-600 flex items-center justify-center text-xs">侍</div>
               Samurai Command Center
            </h1>
            <p className="text-slate-400">Operaciones Tácticas & Inteligencia de Datos</p>
          </div>
          <div className="flex items-center gap-3 bg-slate-900/50 p-2 px-4 rounded-full border border-slate-800 h-10 shadow-lg">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             <span className="text-[10px] font-mono text-slate-300 uppercase tracking-widest">
                KERNEL: ONLINE | LATENCY: {latency}ms
             </span>
          </div>
        </div>

        {/* TOP STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Salud Meta CAPI" value={`${Math.round((stats.capiReadyLeads / (stats.totalLeads || 1)) * 100)}%`} icon={Fingerprint} color="text-indigo-400" bg="bg-indigo-500/10" footer={`${stats.capiReadyLeads} Leads con Datos Full`} />
          <StatCard title="Alertas #CIA" value={stats.totalErrors} icon={AlertTriangle} color="text-yellow-500" bg="bg-yellow-500/10" footer="Mejoras de Conducta" />
          <StatCard title="Ventas Validadas" value={stats.validatedSales} icon={DollarSign} color="text-emerald-500" bg="bg-emerald-500/10" footer="Reservas de $1500 Confirmadas" />
          <StatCard title="Total Prospectos" value={stats.totalLeads} icon={Users2} color="text-slate-400" bg="bg-slate-500/10" footer="Tráfico Acumulado" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="bg-slate-900 border-slate-800 flex flex-col shadow-2xl">
                  <CardHeader className="py-4 border-b border-slate-800">
                     <CardTitle className="text-white text-xs flex items-center gap-2 uppercase tracking-widest">
                        <BarChart3 className="w-4 h-4 text-indigo-400" /> Pipeline de Conversión (CAPI)
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 h-[250px]">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={funnelData} layout="vertical" margin={{ left: 20 }}>
                           <XAxis type="number" hide />
                           <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={100} />
                           <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '10px' }} />
                           <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={25}>
                              {funnelData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                           </Bar>
                        </BarChart>
                     </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800 flex flex-col shadow-2xl">
                  <CardHeader className="py-4 border-b border-slate-800">
                     <CardTitle className="text-white text-xs flex items-center gap-2 uppercase tracking-widest">
                        <MessageSquare className="w-4 h-4 text-emerald-400" /> Actividad Reciente
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-800/50">
                        {recentChats.length === 0 ? (
                           <div className="p-6 text-center text-[10px] text-slate-500 italic">Sin chats en las últimas 24h</div>
                        ) : recentChats.map((chat) => (
                          <div key={chat.id} className="p-3 hover:bg-slate-800/20 transition-colors flex flex-col gap-1">
                              <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-slate-300">{chat.leads?.nombre || 'Anónimo'}</span>
                                  <span className="text-[9px] text-slate-600 font-mono">{new Date(chat.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate italic">"{chat.mensaje}"</p>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
             </div>

             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <QuickButton label="Probar IA" path="/brain?tab=simulador" icon={Zap} color="bg-indigo-600/10 text-indigo-500 border-indigo-500/20" />
                <QuickButton label="Audit CAPI" path="/leads" icon={Fingerprint} color="bg-emerald-600/10 text-emerald-500 border-emerald-500/20" />
                <QuickButton label="Media OCR" path="/media" icon={ImageIcon} color="bg-blue-600/10 text-blue-500 border-blue-500/20" />
                <QuickButton label="Bitácora" path="/learning" icon={Brain} color="bg-purple-600/10 text-purple-500 border-purple-500/20" />
             </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <SystemStatus />
            <BrainHealthCard health={brainHealth} />
            <TaskRadar tasks={tasks} />
            
            <Card className="bg-black border-slate-800 font-mono text-[9px] shadow-2xl flex flex-col rounded-xl overflow-hidden min-h-[250px]">
              <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
                 <div className="flex items-center gap-2 text-slate-500"><Terminal className="w-3.5 h-3.5" /><span className="font-bold uppercase tracking-widest">System Log</span></div>
              </div>
              <ScrollArea className="h-[200px] p-4">
                 <div className="space-y-1.5">
                    {stats.recentLogs.map((log, i) => (
                        <div key={i} className="flex items-start gap-2 border-l border-slate-800 pl-2">
                          <span className="text-slate-600 shrink-0">[{new Date(log.created_at).toLocaleTimeString()}]</span> 
                          <span className={cn(
                              "shrink-0 px-1 rounded uppercase font-bold",
                              log.action === 'ERROR' ? 'bg-red-500/20 text-red-500' : 
                              log.action === 'CREATE' ? 'bg-green-500/20 text-green-500' :
                              'bg-indigo-500/20 text-indigo-400'
                          )}>{log.action}</span> 
                          <span className="text-slate-400 truncate max-w-[200px]">{log.description}</span>
                        </div>
                    ))}
                 </div>
              </ScrollArea>
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
     className={cn("flex flex-col h-20 gap-2 items-center justify-center border transition-all hover:scale-105", color)} 
     onClick={() => window.location.href = path}
   >
      <Icon className="w-5 h-5" />
      <span className="text-[9px] uppercase font-bold tracking-widest">{label}</span>
   </Button>
);

const StatCard = ({ title, value, icon: Icon, color, bg, footer }: any) => (
  <Card className="bg-slate-900 border-slate-800 p-6 hover:border-indigo-500/30 transition-all group shadow-lg">
    <div className="flex justify-between items-start">
      <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</p><h3 className="text-3xl font-bold text-white mt-2">{value}</h3></div>
      <div className={cn("p-3 rounded-xl shadow-inner", bg, color, "group-hover:rotate-12 transition-transform")}><Icon className="w-6 h-6" /></div>
    </div>
    <p className="mt-4 text-[9px] text-slate-600 font-mono uppercase tracking-widest">{footer}</p>
  </Card>
);

export default Index;