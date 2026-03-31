import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle, Send } from 'lucide-react';
import { toast } from 'sonner';

const MetaVerify = () => {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>({});
  const [channel, setChannel] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const { data: configs } = await supabase.from('app_config').select('key, value').in('key', [
      'meta_pixel_id', 'meta_access_token', 'meta_test_mode', 'meta_test_event_code'
    ]);
    const cfgMap: any = {};
    configs?.forEach(c => { cfgMap[c.key] = c.value; });
    setConfig(cfgMap);

    const { data: ch } = await supabase.from('whatsapp_channels').select('*').eq('provider', 'meta').eq('is_active', true).limit(1).maybeSingle();
    setChannel(ch);
    setLoading(false);
  };

  const addResult = (name: string, status: 'ok' | 'error' | 'running', detail: string) => {
    setResults(prev => {
      const existing = prev.findIndex(r => r.name === name);
      const entry = { name, status, detail, time: new Date().toLocaleTimeString() };
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = entry;
        return updated;
      }
      return [...prev, entry];
    });
  };

  const runVerification = async () => {
    setRunning(true);
    setResults([]);

    // === TEST 1: whatsapp_business_messaging ===
    addResult('whatsapp_business_messaging', 'running', 'Enviando mensaje de prueba...');
    try {
      if (!channel) throw new Error('No hay canal Meta activo');
      const { data, error } = await supabase.functions.invoke('send-message-v3', {
        body: {
          channel_id: channel.id,
          phone: '5215646605824',
          message: '✅ Verificación API: whatsapp_business_messaging activo. Este mensaje fue generado automáticamente por SAMURAI CRM.'
        }
      });
      if (error || (data && !data.success)) {
        throw new Error(data?.error || error?.message || 'Error desconocido');
      }
      addResult('whatsapp_business_messaging', 'ok', `Mensaje enviado. wamid: ${data?.wamid || 'N/A'}`);
    } catch (err: any) {
      addResult('whatsapp_business_messaging', 'error', err.message);
    }

    // === TEST 2: whatsapp_business_manage_events ===
    addResult('whatsapp_business_manage_events', 'running', 'Enviando evento de conversión...');
    try {
      const pixelId = config.meta_pixel_id;
      const accessToken = config.meta_access_token;
      if (!pixelId || !accessToken) throw new Error('Pixel ID o Access Token no configurados. Ve a /meta-capi');

      const { data, error } = await supabase.functions.invoke('meta-capi-sender', {
        body: {
          config: {
            pixel_id: pixelId,
            access_token: accessToken,
            test_event_code: config.meta_test_event_code || undefined
          },
          eventData: {
            event_name: 'Lead',
            event_id: `verify_${Date.now()}`,
            value: 0,
            user_data: {
              ph: '5215646605824',
              fn: 'Verificacion',
              ln: 'SAMURAI',
              ct: 'Mexico',
              country: 'mx',
              external_id: 'samurai_verify_test'
            },
            custom_data: {
              source: 'meta_verify_page',
              content_name: 'API Verification Test'
            }
          }
        }
      });
      if (error) throw error;
      const metaResponse = data?.response;
      if (metaResponse?.events_received) {
        addResult('whatsapp_business_manage_events', 'ok', `Evento recibido por Meta. events_received: ${metaResponse.events_received}`);
      } else if (metaResponse?.error) {
        throw new Error(metaResponse.error.message || JSON.stringify(metaResponse.error));
      } else {
        addResult('whatsapp_business_manage_events', 'ok', `Evento enviado. Respuesta: ${JSON.stringify(metaResponse).substring(0, 150)}`);
      }
    } catch (err: any) {
      addResult('whatsapp_business_manage_events', 'error', err.message);
    }

    setRunning(false);
    toast.success('Verificación completada');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Meta API Verification</h1>
          <p className="text-slate-500 text-sm mt-1">Página oculta — dispara verificaciones para Meta Business.</p>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between p-3 bg-[#161618] border border-[#222225] rounded-xl">
            <span className="text-slate-400">Canal Meta</span>
            <span className={channel ? "text-emerald-400" : "text-red-400"}>{channel ? `${channel.name} (${channel.instance_id})` : 'No encontrado'}</span>
          </div>
          <div className="flex justify-between p-3 bg-[#161618] border border-[#222225] rounded-xl">
            <span className="text-slate-400">Pixel ID</span>
            <span className={config.meta_pixel_id ? "text-emerald-400 font-mono" : "text-red-400"}>{config.meta_pixel_id || 'No configurado'}</span>
          </div>
          <div className="flex justify-between p-3 bg-[#161618] border border-[#222225] rounded-xl">
            <span className="text-slate-400">Access Token CAPI</span>
            <span className={config.meta_access_token ? "text-emerald-400" : "text-red-400"}>{config.meta_access_token ? '••••••' + config.meta_access_token.slice(-6) : 'No configurado'}</span>
          </div>
        </div>

        <button
          onClick={runVerification}
          disabled={running}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          {running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          {running ? 'Ejecutando verificaciones...' : 'Ejecutar Verificación Meta'}
        </button>

        {results.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Resultados</h2>
            {results.map((r, i) => (
              <div key={i} className={`p-4 rounded-xl border ${
                r.status === 'ok' ? 'bg-emerald-900/10 border-emerald-500/30' :
                r.status === 'error' ? 'bg-red-900/10 border-red-500/30' :
                'bg-slate-900 border-slate-800'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {r.status === 'ok' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> :
                   r.status === 'error' ? <XCircle className="w-4 h-4 text-red-500" /> :
                   <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
                  <span className="text-white font-bold text-sm font-mono">{r.name}</span>
                  <span className="text-[10px] text-slate-600 ml-auto">{r.time}</span>
                </div>
                <p className="text-xs text-slate-400 pl-6 break-all">{r.detail}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MetaVerify;
