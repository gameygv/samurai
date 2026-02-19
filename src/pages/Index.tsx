import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SystemStatus } from '@/components/SystemStatus';
import { cn } from '@/lib/utils';
import { 
  Database, Shield, Activity, Terminal, AlertTriangle, 
  CheckCircle2, MessageSquare, TrendingUp, Clock, Loader2,
  Zap, Brain, RefreshCw, Send, ArrowRight, UserCheck, ShieldAlert, BarChart3, Users2, DollarSign, Globe, Eye
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
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
    totalLeads: 0,
    webHealth: 0
  });
  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [latency, setLatency] = useState<number>(0);

  useEffect(() => {
    fetchData();
    fetchRecentChats();
    measureLatency();
  }, []);

  const measureLatency = async () => {
     const start = performance.now();
     await supabase.from('profiles').select('count', { count: 'exact', head: true });
     const end = performance.now();
     setLatency(Math.round(end - start));
  };

  const fetchData = async () => {
    try {
      const [errorsRes, pendingRes, versionsRes, logsRes, followupsRes, leadsRes, webRes] = await Promise.all([
        supabase.from('errores_ia').select('count', { count: 'exact', head: true }),
        supabase.from('errores_ia').select('count', { count: 'exact', head: true }).eq('estado_correccion', 'REPORTADA'),
        supabase.from('versiones_prompts_aprendidas').select('*').order('created_at', { ascending: true }),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('leads').select('count', { count: 'exact', head: true }).not('next_followup_at', 'is', null),
        supabase.from('leads').select('*'),
        supabase.from('main_website_content').select('scrape_status')
      ]);

      const leads = leadsRes.data || [];
      const identified = leads.filter(l => l.nombre && !l.nombre.includes('Nuevo Lead')).length;
      
      const webPages = webRes.data || [];
      const healthyPages = webPages.filter(p => p.scrape_status === 'success').length;
      const webHealth = webPages.length > 0 ? Math.round((healthyPages / webPages.length) * 100) : 0;

      // Generar datos del Funnel
      const funnel = [
        { name: 'Nuevos', value: leads.length, color: '#6366f1' },
        { name: 'Calificados', value: leads.filter(l => l.buying_intent === 'MEDIO' || l.buying_intent === 'ALTO').length, color: '#818cf8' },
        { name: 'En Cierre', value: leads.filter(l => l.buying_intent === 'ALTO').length, color: '#c084fc' },
        { name: 'Ventas', value: leads.filter(l => l.buying_intent === 'CLOSED' || l.confidence_score > 90).length, color: '#22c55e' }
      ];
      setFunnelData(funnel);

      setStats({
        totalErrors: errorsRes.count || 0,
        pendingCorrections: pendingRes.count || 0,
        activeVersions: (versionsRes.data || []).length,
        recentLogs: logsRes.data || [],
        activeFollowups: followupsRes.count || 0,
        scheduledRestarts: 0,
        identifiedLeads: identified,
        totalLeads: leads.length,
        webHealth
      });
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

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div></Layout>;

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
          <StatCard title="Verdad Maestra" value={`${stats.webHealth}%`} icon={Globe} color="text-indigo-500" bg="bg-indigo-500/10" footer="Indexación Web" />
          <StatCard title="Follow-ups" value={stats.activeFollowups} icon={RefreshCw} color="text-blue-500" bg="bg-blue-500/10" footer="Reintentos en cola" />
          <StatCard title="Identificados" value={stats.identifiedLeads} icon={UserCheck} color="text-green-500" bg="bg-green-500/10" footer={`de ${stats.totalLeads} prospectos`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* GRÁFICA DE EMBUDO */}
                <Card className="bg-slate-900 border-slate-800 flex flex-col">
                  <CardHeader className="py-4 border-b border-slate-800">
                     <CardTitle className="text-white text-sm flex items-center gap-2 uppercase tracking-tighter">
                        <BarChart3 className="w-4 h-4 text-indigo-400" /> Embudo de Conversión
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 h-[250px]">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={funnelData} layout="vertical" margin={{ left: -20 }}>
                           <XAxis type="number" hide />
                           <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={80} />
                           <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '10px' }} />
                           <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                              {funnelData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                           </Bar>
                        </BarChart>
                     </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* VERDAD MAESTRA STATUS */}
                <Card className="bg-slate-900 border-slate-800 flex flex-col">
                  <CardHeader className="py-4 border-b border-slate-800">
                     <CardTitle className="text-white text-sm flex items-center gap-2 uppercase tracking-tighter">
                        <Eye className="w-4 h-4 text-emerald-400" /> Salud de la Verdad Maestra
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                     <div className="relative w-32 h-32 mb-4">
                        <svg className="w-full h-full" viewBox="0 0 100 100">
                           <circle className="text-slate-800 stroke-current" strokeWidth="8" fill="transparent" r="40" cx="50" cy="50" />
                           <circle className="text-indigo-500 stroke-current" strokeWidth="8" strokeDasharray={`${stats.webHealth * 2.51} 251.2`} strokeLinecap="round" fill="transparent" r="40" cx="50" cy="50" style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                           <span className="text-2xl font-bold text-white">{stats.webHealth}%</span>
                        </div>
                     </div>
                     <p className="text-xs text-slate-400">Tu Samurai está operando con el {stats.webHealth}% del conocimiento web oficial indexado.</p>
                     <Button variant="link" className="text-indigo-400 text-[10px] mt-2 uppercase font-bold tracking-widest" onClick={() => window.location.href='/website-content'}>
                        Optimizar Verdad <ArrowRight className="w-3 h-3 ml-1" />
                     </Button>
                  </CardContent>
                </Card>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MiniTable title="Live Feed" icon={MessageSquare} color="text-emerald-400" items={recentChats} />
                <Card className="bg-slate-900 border-slate-800 shadow-xl">
                   <CardHeader className="py-3 border-b border-slate-800"><CardTitle className="text-[10px] uppercase text-white tracking-widest">Atajos Rápidos</CardTitle></CardHeader>
                   <CardContent className="p-4 grid grid-cols-2 gap-3">
                      <QuickButton label="Probar Cerebro" path="/brain?tab=simulador" icon={Zap} color="bg-indigo-600" />
                      <QuickButton label="Media Manager" path="/media" icon={ImageIcon} color="bg-blue-600" />
                      <QuickButton label="Bitácora #CIA" path="/learning" icon={Brain} color="bg-purple-600" />
                      <QuickButton label="Ajustes API" path="/settings" icon={SettingsIcon} color="bg-slate-700" />
                   </CardContent>
                </Card>
             </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <SystemStatus />
            <Card className="bg-black border-slate-800 font-mono text-[10px] shadow-2xl flex flex-col rounded-xl overflow-hidden min-h-[400px]">
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
                 <div className="flex items-center gap-2 text-slate-500"><Terminal className="w-4 h-4" /><span className="font-bold uppercase tracking-tighter">Kernel Logs</span></div>
              </div>
              <div className="p-4 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
                 {stats.recentLogs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2">
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

const QuickButton = ({ label, path, icon: Icon, color }: any) => (
   <Button className={cn("flex flex-col h-20 gap-2 items-center justify-center", color)} onClick={() => window.location.href = path}>
      <Icon className="w-5 h-5" />
      <span className="text-[9px] uppercase font-bold">{label}</span>
   </Button>
);

const StatCard = ({ title, value, icon: Icon, color, bg, footer }: any) => (
  <Card className="bg-slate-900 border-slate-800 p-6 hover:border-indigo-500/30 transition-all group">
    <div className="flex justify-between items-start">
      <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</p><h3 className="text-3xl font-bold text-white mt-2">{value}</h3></div>
      <div className={cn("p-3 rounded-xl shadow-inner", bg, color, "group-hover:rotate-12 transition-transform")}><Icon className="w-6 h-6" /></div>
    </div>
    <p className="mt-4 text-[9px] text-slate-600 font-mono uppercase tracking-tighter">{footer}</p>
  </Card>
);

const MiniTable = ({ title, icon: Icon, color, items }: any) => (
  <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
    <CardHeader className="border-b border-slate-800 py-3 bg-slate-950/20">
       <CardTitle className="text-white text-[10px] uppercase tracking-widest flex items-center gap-2"><Icon className={cn("w-4 h-4", color)} /> {title}</CardTitle>
    </CardHeader>
    <CardContent className="p-0">
       <div className="divide-y divide-slate-800">
          {items.map((item: any) => (
             <div key={item.id} className="p-3 flex items-start gap-3 hover:bg-slate-800/50 transition-colors">
                <div className="flex-1 min-w-0">
                   <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[10px] font-bold text-slate-300 truncate">{item.leads?.nombre}</span>
                      <span className="text-[9px] text-slate-600 font-mono">{new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                   </div>
                   <p className="text-[11px] text-slate-500 line-clamp-1 italic">"{item.mensaje}"</p>
                </div>
             </div>
          ))}
       </div>
    </CardContent>
  </Card>
);

import { Settings as SettingsIcon, Image as ImageIcon } from 'lucide-react';

export default Index;