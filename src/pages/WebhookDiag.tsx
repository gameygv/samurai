import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Bot, User, MessageCircle, AlertCircle, CheckCircle2, Terminal, Server, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const WebhookDiag = () => {
  const [allMessages, setAllMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, ia: 0, cliente: 0, humano: 0, error: 0 });

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
          <Button onClick={fetchAll} variant="outline" className="border-slate-700">
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} /> Actualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 space-y-6">
              {/* Stats */}
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

              {/* Lista de mensajes */}
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
                          <Badge variant="outline" className={cn("text-[9px] shrink-0 mt-0.5 min-w-[70px] justify-center", getEmisorColor(msg.emisor, msg.platform))}>
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

           {/* Troubleshooting Guide */}
           <div className="space-y-6">
              <Card className="bg-[#1A1110] border-red-900/50">
                 <CardHeader className="bg-red-950/20 border-b border-red-900/50">
                    <CardTitle className="text-red-400 text-xs uppercase tracking-widest flex items-center gap-2">
                       <Server className="w-4 h-4"/> VPS Troubleshooting
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-5 space-y-4">
                    <div className="space-y-2">
                       <p className="text-[11px] font-bold text-red-200">1. Revisa logs en Easypanel</p>
                       <p className="text-[10px] text-red-300/70 leading-relaxed">
                          Si puedes enviar pero no recibir, busca errores tipo <code className="bg-black px-1 text-red-400">ECONNRESET</code> o <code className="bg-black px-1 text-red-400">Unauthorized</code> en los logs del servicio de Evolution API.
                       </p>
                    </div>
                    <div className="space-y-2">
                       <p className="text-[11px] font-bold text-red-200">2. Variable SERVER_URL</p>
                       <p className="text-[10px] text-red-300/70 leading-relaxed">
                          Asegúrate de que la variable <code className="bg-black px-1 text-red-400">SERVER_URL</code> sea exactamente <code className="bg-black px-1 text-red-400">https://tu-dominio.com</code>.
                       </p>
                    </div>
                    <div className="space-y-2">
                       <p className="text-[11px] font-bold text-red-200">3. Apaga Webhook by Events</p>
                       <p className="text-[10px] text-red-300/70 leading-relaxed">
                          En el panel de Evolution, apaga el switch "Webhook by Events". Debe estar en OFF para que Samurai reciba los datos.
                       </p>
                    </div>
                 </CardContent>
              </Card>

              <div className="p-4 bg-indigo-900/10 border border-indigo-500/20 rounded-xl">
                 <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5" /> Consejo de Sam:
                 </h4>
                 <p className="text-[10px] text-slate-400 leading-relaxed italic">
                    "Si nada de esto funciona, usa el **Modo Emergencia** en el Inbox. Yo seguiré respondiendo allí y tú solo pegas la respuesta en WhatsApp."
                 </p>
              </div>
           </div>
        </div>
      </div>
    </Layout>
  );
};

export default WebhookDiag;