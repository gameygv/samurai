import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Bot, User, MessageCircle, AlertCircle, CheckCircle2, Terminal, Server, ShieldAlert, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const WebhookDiag = () => {
  const [allMessages, setAllMessages] = useState<any[]>([]);
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
      .limit(50);

    // Buscar el último log de intento de webhook
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
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-amber-500" /> Centro de Diagnóstico
            </h1>
            <p className="text-slate-400 text-sm">Monitor de salud de la conexión Evolution API ⟷ Samurai.</p>
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
                    <p className="text-indigo-300/80 text-[11px]">Tu VPS acaba de intentar enviar un evento a las <span className="font-mono text-white">{lastHit}</span>. La conexión de red funciona.</p>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-slate-900 border-slate-800 p-4 text-center">
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Eventos DB</p>
                </Card>
                <Card className="bg-indigo-900/20 border-indigo-500/30 p-4 text-center">
                  <p className="text-2xl font-bold text-indigo-400">{stats.ia}</p>
                  <p className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold">Respuestas IA</p>
                </Card>
                <Card className="bg-slate-900 border-slate-800 p-4 text-center">
                  <p className="text-2xl font-bold text-slate-300">{stats.cliente}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Mensajes Cliente</p>
                </Card>
                <Card className="bg-red-900/20 border-red-500/30 p-4 text-center">
                  <p className="text-2xl font-bold text-red-400">{stats.error}</p>
                  <p className="text-[10px] text-red-400 uppercase tracking-widest font-bold">Fallas</p>
                </Card>
              </div>

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="border-b border-slate-800">
                  <CardTitle className="text-white text-sm uppercase tracking-widest">Últimas Intercepciones</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px]">
                    <div className="divide-y divide-slate-800">
                      {allMessages.length === 0 ? (
                         <div className="py-20 text-center text-slate-600 italic">No se han detectado mensajes entrantes...</div>
                      ) : allMessages.map(msg => (
                        <div key={msg.id} className="p-3 flex items-start gap-3 hover:bg-slate-800/30 transition-colors">
                          <Badge variant="outline" className={cn("text-[9px] shrink-0 mt-0.5 min-w-[70px] justify-center uppercase font-bold", getEmisorColor(msg.emisor, msg.platform))}>
                            {msg.emisor}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-300 truncate">{msg.mensaje}</p>
                            <p className="text-[9px] text-slate-600 mt-0.5 font-mono">
                              {msg.leads?.nombre || 'Lead'} · {msg.platform} · {new Date(msg.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
           </div>

           <div className="space-y-6">
              <Card className="bg-[#1A1110] border-red-900/50">
                 <CardHeader className="bg-red-950/20 border-b border-red-900/50">
                    <CardTitle className="text-red-400 text-xs uppercase tracking-widest flex items-center gap-2">
                       <Server className="w-4 h-4"/> VPS Checklist
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-5 space-y-4">
                    <div className="space-y-2">
                       <p className="text-[11px] font-bold text-red-200">1. URL del Servidor</p>
                       <p className="text-[10px] text-red-300/70 leading-relaxed italic">
                          Asegúrate de que <code className="bg-black px-1 text-red-400">SERVER_URL</code> NO tenga una barra "/" al final.
                       </p>
                    </div>
                    <div className="space-y-2">
                       <p className="text-[11px] font-bold text-red-200">2. Auth Type</p>
                       <p className="text-[10px] text-red-300/70 leading-relaxed italic">
                          Debes tener <code className="bg-black px-1 text-red-400">AUTHENTICATION_TYPE=apikey</code> para validar sesiones.
                       </p>
                    </div>
                    <div className="space-y-2 border-t border-red-900/30 pt-3">
                       <p className="text-[11px] font-bold text-amber-200">3. ¿Sigues sin recibir?</p>
                       <p className="text-[10px] text-amber-300/70 leading-relaxed">
                          Borra la instancia en el panel de Evolution, **reinstala el servicio en Easypanel** y vuelve a escanear el QR. v2 a veces corrompe la sesión local si las variables cambian.
                       </p>
                    </div>
                 </CardContent>
              </Card>
           </div>
        </div>
      </div>
    </Layout>
  );
};

export default WebhookDiag;