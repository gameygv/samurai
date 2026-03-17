import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Bot, User, MessageCircle, AlertCircle, CheckCircle2, Terminal, Server, ShieldAlert, Zap, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

const WebhookDiag = () => {
  const [allMessages, setAllMessages] = useState<any[]>([]);
  const [traces, setTraces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, ia: 0, cliente: 0, humano: 0, error: 0 });
  const [lastHit, setLastHit] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchAll = async () => {
    const { data } = await supabase
      .from('conversaciones')
      .select('*, leads(nombre, telefono)')
      .order('created_at', { ascending: false })
      .limit(30);

    // Buscar Traces de Gowa (Paso a paso)
    const { data: traceLogs } = await supabase
      .from('activity_logs')
      .select('*')
      .ilike('description', 'Webhook Trace:%')
      .order('created_at', { ascending: false })
      .limit(10);

    if (traceLogs) setTraces(traceLogs);

    // Buscar el último Hit visual
    const { data: logs } = await supabase
      .from('activity_logs')
      .select('*')
      .ilike('description', '%Webhook Hit%')
      .order('created_at', { ascending: false })
      .limit(1);

    if (logs && logs.length > 0) {
        setLastHit(new Date(logs[0].created_at).toLocaleTimeString());
    }

    if (data) {
      setAllMessages(data);
      setStats({
        total: data.length,
        ia: data.filter(m => m.emisor === 'IA' || m.emisor === 'SAMURAI').length,
        cliente: data.filter(m => m.emisor === 'CLIENTE').length,
        humano: data.filter(m => m.emisor === 'HUMANO').length,
        error: data.filter(m => m.platform === 'ERROR').length,
      });
    }
    setLoading(false);
  };

  const getEmisorColor = (emisor: string, platform: string) => {
    if (platform === 'ERROR') return 'bg-red-900/30 text-red-400 border-red-500/30';
    switch ((emisor || '').toUpperCase()) {
      case 'IA': case 'SAMURAI': return 'bg-indigo-900/30 text-indigo-400 border-indigo-500/30';
      case 'CLIENTE': return 'bg-slate-800 text-slate-300 border-slate-700';
      case 'HUMANO': return 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30';
      case 'NOTA': return 'bg-amber-900/30 text-amber-400 border-amber-500/30';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-amber-500" /> Centro de Diagnóstico
            </h1>
            <p className="text-slate-400 text-sm">Monitor de salud de la conexión Gowa API ⟷ Samurai.</p>
          </div>
          <Button onClick={fetchAll} variant="outline" className="border-slate-700 text-slate-300">
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} /> Actualizar
          </Button>
        </div>

        {lastHit && (
            <div className="bg-indigo-600/20 border border-indigo-500/50 p-4 rounded-xl flex items-center gap-4 animate-in zoom-in-95">
                <div className="p-2 bg-indigo-500 rounded-lg animate-pulse">
                    <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h3 className="text-indigo-100 font-bold text-sm">¡TRÁFICO DETECTADO!</h3>
                    <p className="text-indigo-300/80 text-[11px]">Gowa intentó contactar a Samurai a las <span className="font-mono text-white">{lastHit}</span>. La red está operativa.</p>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
           <div className="lg:col-span-8 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-slate-900 border-slate-800 p-4 text-center shadow-lg">
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Eventos DB</p>
                </Card>
                <Card className="bg-indigo-900/20 border-indigo-500/30 p-4 text-center shadow-lg">
                  <p className="text-2xl font-bold text-indigo-400">{stats.ia}</p>
                  <p className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold">Respuestas IA</p>
                </Card>
                <Card className="bg-slate-900 border-slate-800 p-4 text-center shadow-lg">
                  <p className="text-2xl font-bold text-slate-300">{stats.cliente}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Mensajes Cliente</p>
                </Card>
                <Card className="bg-red-900/20 border-red-500/30 p-4 text-center shadow-lg">
                  <p className="text-2xl font-bold text-red-400">{stats.error}</p>
                  <p className="text-[10px] text-red-400 uppercase tracking-widest font-bold">Fallas</p>
                </Card>
              </div>

              <Card className="bg-slate-900 border-slate-800 shadow-xl">
                <CardHeader className="border-b border-slate-800 bg-slate-950/40">
                  <CardTitle className="text-white text-sm uppercase tracking-widest">Bandeja de Diagnóstico (Recientes)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[350px]">
                    <div className="divide-y divide-slate-800">
                      {allMessages.length === 0 ? (
                         <div className="py-20 text-center text-slate-600 italic">No se han detectado mensajes en la base de datos...</div>
                      ) : allMessages.map(msg => (
                        <div key={msg.id} className="p-4 flex items-start gap-3 hover:bg-slate-800/30 transition-colors">
                          <Badge variant="outline" className={cn("text-[9px] shrink-0 mt-0.5 min-w-[75px] justify-center uppercase font-bold", getEmisorColor(msg.emisor, msg.platform))}>
                            {msg.emisor}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-200">{msg.mensaje}</p>
                            <p className="text-[9px] text-slate-500 mt-1 font-mono">
                              {msg.leads?.nombre || 'Lead'} · {msg.leads?.telefono} · {new Date(msg.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
           </div>

           <div className="lg:col-span-4 space-y-6">
              <Card className="bg-[#0A0A0A] border-indigo-900/50 shadow-2xl h-full flex flex-col">
                 <CardHeader className="bg-indigo-950/20 border-b border-indigo-900/30 shrink-0">
                    <CardTitle className="text-indigo-400 text-xs uppercase tracking-widest flex items-center gap-2">
                       <Activity className="w-4 h-4"/> Gowa Trace Logs
                    </CardTitle>
                    <p className="text-[9px] text-slate-500 mt-1">Qué procesa el Webhook paso a paso.</p>
                 </CardHeader>
                 <ScrollArea className="flex-1 p-4">
                    <div className="space-y-3 font-mono text-[10px]">
                       {traces.length === 0 ? (
                          <p className="text-slate-600 italic text-center py-10">Esperando el próximo pulso de Gowa...</p>
                       ) : traces.map((t, i) => (
                          <div key={i} className={cn("p-2.5 rounded-lg border", t.status === 'ERROR' ? "bg-red-950/30 border-red-900/50 text-red-400" : "bg-slate-900/50 border-slate-800 text-emerald-400")}>
                             <p className="opacity-50 mb-1">{new Date(t.created_at).toLocaleTimeString()}</p>
                             <p className="leading-relaxed">{t.description.replace('Webhook Trace: ', '')}</p>
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

export default WebhookDiag;