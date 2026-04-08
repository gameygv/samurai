import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle, Send, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const WABA_ID = '826295413577660';
const GRAPH_EXPLORER_URL = 'https://developers.facebook.com/tools/explorer/';

const MetaVerify = () => {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>({});
  const [channel, setChannel] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    const { data: configs } = await supabase.from('app_config').select('key, value').in('key', [
      'meta_pixel_id', 'meta_test_mode', 'meta_test_event_code'
    ]);
    const cfgMap: any = {};
    configs?.forEach(c => { cfgMap[c.key] = c.value; });
    setConfig(cfgMap);
    const { data: ch } = await supabase.from('whatsapp_channels').select('*').eq('provider', 'meta').eq('is_active', true).limit(1).maybeSingle();
    setChannel(ch);
    setLoading(false);
  };

  const addResult = (name: string, status: 'ok' | 'error' | 'running' | 'manual', detail: string) => {
    setResults(prev => {
      const existing = prev.findIndex(r => r.name === name);
      const entry = { name, status, detail, time: new Date().toLocaleTimeString() };
      if (existing >= 0) { const updated = [...prev]; updated[existing] = entry; return updated; }
      return [...prev, entry];
    });
  };

  const runAllVerifications = async () => {
    setRunning(true);
    setResults([]);

    // === 1. whatsapp_business_messaging (200 calls — ya funciona, pero verificamos) ===
    addResult('whatsapp_business_messaging', 'running', 'Enviando mensaje de prueba...');
    try {
      if (!channel) throw new Error('No hay canal Meta activo');
      const { data, error } = await supabase.functions.invoke('send-message-v3', {
        body: { channel_id: channel.id, phone: '5215646605824', message: '✅ Verificación API: whatsapp_business_messaging activo.' }
      });
      if (error || (data && !data.success)) throw new Error(data?.error || error?.message || 'Error desconocido');
      addResult('whatsapp_business_messaging', 'ok', `Mensaje enviado. wamid: ${data?.wamid || 'N/A'}`);
    } catch (err: any) {
      addResult('whatsapp_business_messaging', 'error', err.message);
    }

    // === 2. whatsapp_business_manage_events (0 calls — NUEVO: WA CAPI endpoint) ===
    addResult('whatsapp_business_manage_events', 'running', 'Obteniendo Dataset ID y enviando evento WA CAPI...');
    try {
      const { data, error } = await supabase.functions.invoke('meta-wa-capi-verify', {
        body: { waba_id: WABA_ID, wa_channel_token: channel?.api_key || null, test_event_code: config.meta_test_event_code || undefined }
      });
      if (error) throw error;

      const steps = data?.steps || [];
      const lastStep = steps[steps.length - 1];
      const allDetails = steps.map((s: any) => `[${s.status}] ${s.step}: ${s.detail}`).join('\n');

      if (data?.success) {
        addResult('whatsapp_business_manage_events', 'ok', `WA CAPI evento enviado. Dataset: ${data.dataset_id}\n${allDetails}`);
      } else {
        addResult('whatsapp_business_manage_events', 'error', allDetails);
      }
    } catch (err: any) {
      addResult('whatsapp_business_manage_events', 'error', err.message);
    }

    // === 3. whatsapp_business_manage_events (fallback: Pixel CAPI estándar) ===
    addResult('pixel_capi_standard', 'running', 'Enviando evento Lead al Pixel estándar...');
    try {
      const pixelId = config.meta_pixel_id;
      if (!pixelId) throw new Error('Pixel ID no configurado');

      const { data, error } = await supabase.functions.invoke('meta-capi-sender', {
        body: {
          config: { pixel_id: pixelId, test_event_code: config.meta_test_event_code || undefined },
          eventData: {
            event_name: 'Lead', event_id: `verify_pixel_${Date.now()}`, value: 0,
            user_data: { ph: '5215646605824', fn: 'Verificacion', ln: 'SAMURAI', ct: 'Mexico', country: 'mx', external_id: 'samurai_verify' },
            custom_data: { source: 'meta_verify_page', content_name: 'Pixel CAPI Verification' }
          }
        }
      });
      if (error) throw error;
      const metaResponse = data?.response;
      if (metaResponse?.events_received) {
        addResult('pixel_capi_standard', 'ok', `Pixel evento recibido. events_received: ${metaResponse.events_received}`);
      } else if (metaResponse?.error) {
        throw new Error(metaResponse.error.message || JSON.stringify(metaResponse.error));
      } else {
        addResult('pixel_capi_standard', 'ok', `Enviado. Respuesta: ${JSON.stringify(metaResponse).substring(0, 150)}`);
      }
    } catch (err: any) {
      addResult('pixel_capi_standard', 'error', err.message);
    }

    // === 4. email (manual — necesita Graph API Explorer) ===
    addResult('email', 'manual', 'Requiere acción manual. Abre Graph API Explorer, selecciona tu app, agrega permiso "email", genera token, ejecuta: GET /me?fields=email');

    // === 5. manage_app_solution (manual) ===
    addResult('manage_app_solution', 'manual', 'Requiere acción manual. Abre Graph API Explorer, selecciona tu app, ejecuta: GET /me/businesses');

    setRunning(false);
    toast.success('Verificación completada');
  };

  if (loading) {
    return (<div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Meta API Verification</h1>
          <p className="text-slate-500 text-sm mt-1">Dispara verificaciones para todos los permisos de Meta Business.</p>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between p-3 bg-[#161618] border border-[#222225] rounded-xl">
            <span className="text-slate-400">Canal Meta</span>
            <span className={channel ? "text-emerald-400" : "text-red-400"}>{channel ? `${channel.name} (${channel.instance_id})` : 'No encontrado'}</span>
          </div>
          <div className="flex justify-between p-3 bg-[#161618] border border-[#222225] rounded-xl">
            <span className="text-slate-400">WABA ID</span>
            <span className="text-emerald-400 font-mono">{WABA_ID}</span>
          </div>
          <div className="flex justify-between p-3 bg-[#161618] border border-[#222225] rounded-xl">
            <span className="text-slate-400">Pixel ID</span>
            <span className={config.meta_pixel_id ? "text-emerald-400 font-mono" : "text-red-400"}>{config.meta_pixel_id || 'No configurado'}</span>
          </div>
          <div className="flex justify-between p-3 bg-[#161618] border border-[#222225] rounded-xl">
            <span className="text-slate-400">Access Token CAPI</span>
            <span className="text-emerald-400">Gestionado via env var (META_ACCESS_TOKEN)</span>
          </div>
        </div>

        <button
          onClick={runAllVerifications}
          disabled={running}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          {running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          {running ? 'Ejecutando 5 verificaciones...' : 'Ejecutar Todas las Verificaciones'}
        </button>

        <a
          href={GRAPH_EXPLORER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 bg-[#161618] hover:bg-[#1a1a1d] border border-[#222225] text-slate-300 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors text-sm"
        >
          <ExternalLink className="w-4 h-4" /> Abrir Graph API Explorer (para email y manage_app_solution)
        </a>

        {results.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Resultados</h2>
            {results.map((r, i) => (
              <div key={i} className={`p-4 rounded-xl border ${
                r.status === 'ok' ? 'bg-emerald-900/10 border-emerald-500/30' :
                r.status === 'error' ? 'bg-red-900/10 border-red-500/30' :
                r.status === 'manual' ? 'bg-amber-900/10 border-amber-500/30' :
                'bg-slate-900 border-slate-800'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {r.status === 'ok' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> :
                   r.status === 'error' ? <XCircle className="w-4 h-4 text-red-500" /> :
                   r.status === 'manual' ? <ExternalLink className="w-4 h-4 text-amber-400" /> :
                   <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
                  <span className="text-white font-bold text-sm font-mono">{r.name}</span>
                  {r.status === 'manual' && <span className="text-[9px] text-amber-400 font-bold uppercase">MANUAL</span>}
                  <span className="text-[10px] text-slate-600 ml-auto">{r.time}</span>
                </div>
                <p className="text-xs text-slate-400 pl-6 break-all whitespace-pre-wrap">{r.detail}</p>
              </div>
            ))}
          </div>
        )}

        <div className="p-4 bg-[#161618] border border-[#222225] rounded-xl space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Instrucciones para permisos manuales</h3>
          <div className="space-y-2 text-xs text-slate-500">
            <p><span className="text-amber-400 font-bold">email:</span> En Graph API Explorer, selecciona tu app, agrega permiso "email", genera token, ejecuta: <code className="text-indigo-400">GET /me?fields=email</code></p>
            <p><span className="text-amber-400 font-bold">manage_app_solution:</span> En Graph API Explorer, ejecuta: <code className="text-indigo-400">GET /me/businesses</code> o <code className="text-indigo-400">GET /me/app_requests</code></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetaVerify;
