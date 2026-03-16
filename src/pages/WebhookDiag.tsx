import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Bot, User, MessageCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
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
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-amber-500" /> Diagnóstico de Mensajes
            </h1>
            <p className="text-slate-400 text-sm">Verifica si el webhook está guardando los mensajes de la IA correctamente.</p>
          </div>
          <Button onClick={fetchAll} variant="outline" className="border-slate-700">
            <RefreshCw className="w-4 h-4 mr-2" /> Actualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-slate-900 border-slate-800 p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-[10px] text-slate-500 uppercase">Total</p>
          </Card>
          <Card className="bg-indigo-900/20 border-indigo-500/30 p-4 text-center">
            <p className="text-2xl font-bold text-indigo-400">{stats.ia}</p>
            <p className="text-[10px] text-indigo-400 uppercase">IA / Bot</p>
          </Card>
          <Card className="bg-slate-900 border-slate-800 p-4 text-center">
            <p className="text-2xl font-bold text-slate-300">{stats.cliente}</p>
            <p className="text-[10px] text-slate-500 uppercase">Cliente</p>
          </Card>
          <Card className="bg-emerald-900/20 border-emerald-500/30 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{stats.humano}</p>
            <p className="text-[10px] text-emerald-400 uppercase">Vendedor</p>
          </Card>
          <Card className="bg-red-900/20 border-red-500/30 p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{stats.error}</p>
            <p className="text-[10px] text-red-400 uppercase">Errores</p>
          </Card>
        </div>

        {/* Si no hay mensajes de IA, mostrar alerta */}
        {stats.ia === 0 && stats.cliente > 0 && (
          <Card className="bg-red-900/20 border-red-500/30 p-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-bold">⚠️ El webhook NO está guardando mensajes de la IA</p>
                <p className="text-sm text-red-300 mt-1">
                  Hay {stats.cliente} mensajes de clientes pero 0 de la IA. 
                  Esto significa que el webhook falla después de llamar a OpenAI.
                  Revisa los logs en: <strong>Supabase Dashboard → Edge Functions → evolution-webhook → Logs</strong>
                </p>
              </div>
            </div>
          </Card>
        )}

        {stats.ia > 0 && (
          <Card className="bg-emerald-900/20 border-emerald-500/30 p-4">
            <div className="flex items-center gap-3 text-emerald-400">
              <CheckCircle2 className="w-6 h-6 shrink-0" />
              <p className="font-bold">✅ El webhook SÍ está guardando mensajes de la IA ({stats.ia} encontrados)</p>
            </div>
          </Card>
        )}

        {/* Lista de mensajes */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800">
            <CardTitle className="text-white text-sm uppercase tracking-widest">Últimos 50 mensajes en la DB</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="divide-y divide-slate-800">
                {allMessages.map(msg => (
                  <div key={msg.id} className="p-3 flex items-start gap-3 hover:bg-slate-800/30">
                    <Badge variant="outline" className={cn("text-[9px] shrink-0 mt-0.5", getEmisorColor(msg.emisor, msg.platform))}>
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
    </Layout>
  );
};

export default WebhookDiag;