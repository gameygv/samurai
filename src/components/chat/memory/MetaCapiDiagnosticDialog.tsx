"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Megaphone, User, Send, Clock, AlertCircle, Target, RefreshCw, Code, Zap, Radio } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string | null;
}

interface DiagnosticField {
  key: string;
  label: string;
  present: boolean;
  required?: boolean;
  critical?: boolean;
  value: string | null;
}

interface LastCapiEvent {
  event_name: string;
  status: string;
  has_fbc: boolean;
  has_fbp: boolean;
  has_ctwa_clid: boolean;
  has_ge: boolean;
  has_zp: boolean;
  has_ct: boolean;
  has_em: boolean;
  source: string | null;
  meta_response_ok: boolean;
  meta_error: string | null;
  created_at: string;
}

interface Diagnostic {
  lead: { id: string; nombre: string; telefono: string; buying_intent: string; lead_score: number; payment_status: string; capi_lead_event_sent_at: string | null };
  identity: { score_percent: number; fields_present: number; fields_total: number; fields: DiagnosticField[] };
  campaign: { has_attribution: boolean; fields: DiagnosticField[]; referral_captured_at: string | null };
  events: {
    sent: Array<{ id: string; action: string; description: string; created_at: string }>;
    pending: Array<{ id: string; action: string; description: string; created_at: string }>;
    errors: Array<{ id: string; action: string; description: string; created_at: string }>;
    sent_count: number;
    pending_count: number;
    error_count: number;
  };
  receipts: Array<{ id: string; verdict: string; amount: number; matched_account: string; bank: string; verified: boolean; created_at: string }>;
  config: { channel_name: string | null; capi_enabled_on_channel: boolean; has_pixel_id: boolean; has_access_token: boolean; test_event_code: string | null; ready_to_send: boolean };
  first_webhook: { raw_snippet: string | null; has_referral: boolean };
  last_capi_event: LastCapiEvent | null;
  diagnostic_errors: string[];
}

export const MetaCapiDiagnosticDialog = ({ open, onOpenChange, leadId }: Props) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Diagnostic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendResult, setResendResult] = useState<string | null>(null);

  const loadDiagnostic = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setError(null);
    setData(null);
    setResendResult(null);
    try {
      await supabase.functions.invoke('analyze-leads', { body: { lead_id: leadId, force: true } });
      await new Promise(r => setTimeout(r, 800));
      const { data: diagnostic, error: fnErr } = await supabase.functions.invoke('get-capi-diagnostic', { body: { lead_id: leadId } });
      if (fnErr) throw fnErr;
      setData(diagnostic as Diagnostic);
    } catch (e: any) {
      setError(e?.message || 'Error al cargar diagnóstico');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (!open || !leadId) return;
    loadDiagnostic();
  }, [open, leadId, loadDiagnostic]);

  const handleResendCapi = async () => {
    if (!leadId || !data) return;
    setResending(true);
    setResendResult(null);
    try {
      const eventMap: Record<string, string> = { BAJO: 'Lead', MEDIO: 'ViewContent', ALTO: 'InitiateCheckout', COMPRADO: 'Purchase' };
      const eventName = eventMap[data.lead.buying_intent] || 'Lead';

      const { data: configs } = await supabase.from('app_config').select('key, value').in('key', ['meta_pixel_id', 'meta_access_token', 'meta_test_event_code']);
      const cfgMap = (configs || []).reduce((a: Record<string, string>, c: { key: string; value: string }) => ({ ...a, [c.key]: c.value }), {} as Record<string, string>);

      const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single();
      if (!lead) throw new Error('Lead no encontrado');

      const { data: result, error: sendErr } = await supabase.functions.invoke('meta-capi-sender', {
        body: {
          config: { pixel_id: cfgMap.meta_pixel_id, access_token: cfgMap.meta_access_token, test_event_code: cfgMap.meta_test_event_code || undefined },
          eventData: {
            event_name: eventName,
            event_id: `samurai_${lead.id}_manual_${Math.floor(Date.now() / 1000)}`,
            lead_id: lead.id,
            user_data: {
              ph: lead.telefono, fn: lead.nombre?.split(' ')[0], ln: lead.nombre?.split(' ').slice(1).join(' ') || undefined,
              em: lead.email || undefined, ct: lead.ciudad || undefined, st: lead.estado || undefined,
              zp: lead.cp || undefined, country: 'mx', external_id: lead.id,
              fbc: lead.fbc || undefined, fbp: lead.fbp || undefined
            },
            custom_data: {
              source: 'samurai_manual_test', funnel_stage: lead.buying_intent, origin_channel: 'whatsapp',
              currency: eventName === 'Purchase' ? 'MXN' : undefined, value: eventName === 'Purchase' ? 0 : undefined
            }
          }
        }
      });
      if (sendErr) throw sendErr;
      const ok = result?.response?.events_received > 0;
      setResendResult(ok ? `✓ ${eventName} enviado — Meta recibió ${result.response.events_received} evento(s)` : `✗ Error: ${result?.response?.error?.error_user_title || 'Respuesta inesperada'}`);
      // Recargar diagnóstico para ver el evento nuevo
      setTimeout(() => loadDiagnostic(), 1500);
    } catch (e: any) {
      setResendResult(`✗ Error: ${e?.message || 'Fallo al enviar'}`);
    } finally {
      setResending(false);
    }
  };

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0a0c] border-[#222225] text-slate-200 max-w-3xl max-h-[85vh] overflow-y-auto custom-scrollbar rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xs uppercase tracking-widest font-bold text-amber-400 flex items-center gap-2">
            <Target className="w-4 h-4" /> Diagnóstico Meta CAPI
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <span className="text-[10px] uppercase tracking-widest text-slate-500">Re-analizando lead y recolectando datos...</span>
          </div>
        )}

        {error && !loading && (
          <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 inline mr-2" />{error}
          </div>
        )}

        {data && !loading && (
          <div className="space-y-5 text-xs">

            {/* Estado general */}
            <section className="bg-[#121214] border border-[#222225] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#7A8A9E] uppercase tracking-widest">Lead</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px] bg-indigo-950/30 text-indigo-400 border-indigo-900/50 uppercase font-bold tracking-widest">
                    {data.lead.buying_intent}
                  </Badge>
                  {data.config.channel_name && <span className="text-[9px] text-slate-600">{data.config.channel_name}</span>}
                </div>
              </div>
              <div className="text-sm font-bold text-slate-100">{data.lead.nombre}</div>
              <div className="text-[10px] text-slate-500">
                Score: <strong className="text-amber-400">{data.lead.lead_score || 0}/100</strong> ·
                Pago: <strong className={data.lead.payment_status === 'VALID' ? 'text-emerald-400' : 'text-slate-400'}>{data.lead.payment_status || 'SIN COMPROBANTE'}</strong>
              </div>
              <div className="text-[9px] text-slate-600">
                CAPI canal: {data.config.ready_to_send ? <span className="text-emerald-400">✓ listo</span> : <span className="text-red-400">✗ no listo</span>}
                {data.config.test_event_code && <span className="ml-2 text-amber-400">[test_event: {data.config.test_event_code}]</span>}
              </div>
            </section>

            {/* Identity Matching */}
            <section>
              <h4 className="text-[10px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center gap-2 mb-2">
                <User className="w-3.5 h-3.5 text-indigo-400" /> Identity Matching · {data.identity.fields_present}/{data.identity.fields_total} campos ({data.identity.score_percent}%)
              </h4>
              <div className="h-1 bg-[#161618] rounded-full mb-2 overflow-hidden">
                <div className={cn("h-full transition-all", data.identity.score_percent > 70 ? 'bg-emerald-500' : data.identity.score_percent > 40 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${data.identity.score_percent}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {data.identity.fields.map(f => (
                  <div key={f.key} className="flex items-center gap-2 bg-[#121214] border border-[#222225] rounded-lg px-3 py-2">
                    {f.present
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      : f.required
                        ? <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        : <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-slate-300">{f.label}</div>
                      <div className="text-[9px] text-slate-600 truncate">{f.value || (f.required ? 'REQUERIDO' : '—')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Campaign Attribution */}
            <section>
              <h4 className="text-[10px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center gap-2 mb-2">
                <Megaphone className="w-3.5 h-3.5 text-amber-400" /> Atribución de campaña
                {data.campaign.has_attribution
                  ? <Badge variant="outline" className="text-[8px] bg-emerald-950/30 text-emerald-400 border-emerald-900/50 uppercase font-bold">CTWA</Badge>
                  : <Badge variant="outline" className="text-[8px] bg-slate-800/30 text-slate-500 border-slate-700/50 uppercase font-bold">Orgánico</Badge>
                }
              </h4>
              {!data.campaign.has_attribution ? (
                <div className="p-3 bg-[#121214] border border-[#222225] rounded-xl text-[10px] text-slate-500 italic">
                  Este lead llegó orgánicamente — no hay click_id de anuncio. Meta no podrá atribuirlo a una campaña. Si vino de un anuncio CTWA, verificar que Gowa esté enviando el campo <code className="text-amber-400">referral</code> en el webhook.
                </div>
              ) : (
                <div className="space-y-1">
                  {data.campaign.fields.map(f => (
                    <div key={f.key} className="flex items-start gap-3 bg-[#121214] border border-[#222225] rounded-lg px-3 py-2">
                      {f.present
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        : <XCircle className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", f.critical ? 'text-red-500' : 'text-slate-700')} />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-slate-300">{f.label} {f.critical && <span className="text-red-400">*</span>}</div>
                        <div className="text-[9px] text-slate-600 truncate font-mono">{f.value || '—'}</div>
                      </div>
                    </div>
                  ))}
                  {data.campaign.referral_captured_at && (
                    <div className="text-[9px] text-slate-600 mt-1 italic">Captura: {fmtDate(data.campaign.referral_captured_at)}</div>
                  )}
                </div>
              )}
            </section>

            {/* Último evento CAPI — QUÉ DATOS SE ENVIARON */}
            {data.last_capi_event && (
              <section>
                <h4 className="text-[10px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center gap-2 mb-2">
                  <Radio className="w-3.5 h-3.5 text-cyan-400" /> Último evento CAPI enviado
                </h4>
                <div className={cn("p-3 rounded-xl border", data.last_capi_event.meta_response_ok ? 'bg-emerald-950/20 border-emerald-900/30' : 'bg-red-950/20 border-red-900/30')}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn("text-[11px] font-bold", data.last_capi_event.meta_response_ok ? 'text-emerald-300' : 'text-red-300')}>
                      {data.last_capi_event.event_name} · {data.last_capi_event.status}
                    </span>
                    <span className="text-[9px] text-slate-600">{fmtDate(data.last_capi_event.created_at)}</span>
                  </div>
                  {data.last_capi_event.meta_error && (
                    <div className="text-[10px] text-red-400 mb-2">Error: {data.last_capi_event.meta_error}</div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: 'em', label: 'Email', has: data.last_capi_event.has_em },
                      { key: 'ct', label: 'Ciudad', has: data.last_capi_event.has_ct },
                      { key: 'zp', label: 'CP', has: data.last_capi_event.has_zp },
                      { key: 'ge', label: 'Género', has: data.last_capi_event.has_ge },
                      { key: 'fbc', label: 'fbc', has: data.last_capi_event.has_fbc },
                      { key: 'fbp', label: 'fbp', has: data.last_capi_event.has_fbp },
                      { key: 'ctwa', label: 'ctwa_clid', has: data.last_capi_event.has_ctwa_clid },
                    ].map(f => (
                      <span key={f.key} className={cn(
                        "text-[9px] px-2 py-0.5 rounded-full font-mono",
                        f.has ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/50' : 'bg-[#161618] text-slate-600 border border-[#222225]'
                      )}>
                        {f.has ? '✓' : '✗'} {f.label}
                      </span>
                    ))}
                  </div>
                  {data.last_capi_event.source && (
                    <div className="text-[9px] text-slate-600 mt-1">Fuente: <span className="font-mono text-slate-500">{data.last_capi_event.source}</span></div>
                  )}
                </div>
              </section>
            )}

            {/* Botón Re-enviar CAPI */}
            <section className="flex items-center gap-3">
              <button
                onClick={handleResendCapi}
                disabled={resending || !data.config.ready_to_send}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                  data.config.ready_to_send
                    ? "bg-amber-600/20 border border-amber-500/30 text-amber-400 hover:bg-amber-600/30"
                    : "bg-[#161618] border border-[#222225] text-slate-600 cursor-not-allowed"
                )}
              >
                {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Forzar re-envío CAPI
              </button>
              <button
                onClick={loadDiagnostic}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-[#161618] border border-[#222225] text-slate-400 hover:bg-[#222225] transition-all"
              >
                <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} /> Refrescar
              </button>
              {resendResult && (
                <span className={cn("text-[10px]", resendResult.startsWith('✓') ? 'text-emerald-400' : 'text-red-400')}>
                  {resendResult}
                </span>
              )}
            </section>

            {/* Events Sent */}
            <section>
              <h4 className="text-[10px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center gap-2 mb-2">
                <Send className="w-3.5 h-3.5 text-emerald-400" /> Eventos enviados a Meta ({data.events.sent_count})
              </h4>
              {data.events.sent.length === 0 ? (
                <div className="p-3 bg-[#121214] border border-[#222225] rounded-xl text-[10px] text-slate-500 italic">
                  Aún no se ha enviado ningún evento CAPI para este lead.
                </div>
              ) : (
                <div className="space-y-1">
                  {data.events.sent.slice(0, 10).map(e => (
                    <div key={e.id} className="flex items-start gap-2 bg-emerald-950/20 border border-emerald-900/30 rounded-lg px-3 py-2">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-emerald-300 truncate">{e.description}</div>
                        <div className="text-[9px] text-slate-600">{fmtDate(e.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Pending events */}
            {data.events.pending_count > 0 && (
              <section>
                <h4 className="text-[10px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center gap-2 mb-2">
                  <Clock className="w-3.5 h-3.5 text-amber-400" /> Pendientes ({data.events.pending_count})
                </h4>
                <div className="space-y-1">
                  {data.events.pending.map(e => (
                    <div key={e.id} className="flex items-start gap-2 bg-amber-950/20 border border-amber-900/30 rounded-lg px-3 py-2">
                      <Clock className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-amber-300 truncate">{e.description}</div>
                        <div className="text-[9px] text-slate-600">{fmtDate(e.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Errors */}
            {data.events.error_count > 0 && (
              <section>
                <h4 className="text-[10px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center gap-2 mb-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400" /> Errores ({data.events.error_count})
                </h4>
                <div className="space-y-1">
                  {data.events.errors.map(e => (
                    <div key={e.id} className="flex items-start gap-2 bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-2">
                      <XCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-red-300 truncate">{e.description}</div>
                        <div className="text-[9px] text-slate-600">{fmtDate(e.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Receipts */}
            {data.receipts.length > 0 && (
              <section>
                <h4 className="text-[10px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center gap-2 mb-2">
                  <Target className="w-3.5 h-3.5 text-indigo-400" /> Comprobantes detectados ({data.receipts.length})
                </h4>
                <div className="space-y-1">
                  {data.receipts.map(r => (
                    <div key={r.id} className="flex items-start gap-2 bg-[#121214] border border-[#222225] rounded-lg px-3 py-2">
                      <div className="flex-1 min-w-0 text-[10px]">
                        <span className={cn("font-bold",
                          r.verdict === 'PROBABLE_VALID' ? 'text-emerald-400' : r.verdict === 'PROBABLE_INVALID' ? 'text-red-400' : 'text-amber-400'
                        )}>{r.verdict}</span>
                        {r.amount > 0 && <span className="ml-2 text-slate-300">${r.amount.toLocaleString()}</span>}
                        {r.bank && <span className="ml-2 text-slate-500">{r.bank}</span>}
                        <div className="text-[9px] text-slate-600">{r.matched_account} · {fmtDate(r.created_at)}</div>
                      </div>
                      {r.verified && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Webhook crudo del primer mensaje */}
            <section>
              <h4 className="text-[10px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center gap-2 mb-2">
                <Code className="w-3.5 h-3.5 text-slate-500" /> Webhook primer mensaje
                {data.first_webhook?.has_referral
                  ? <Badge variant="outline" className="text-[8px] bg-emerald-950/30 text-emerald-400 border-emerald-900/50 uppercase font-bold">referral detectado</Badge>
                  : <Badge variant="outline" className="text-[8px] bg-slate-800/30 text-slate-600 border-slate-700/50 uppercase font-bold">sin referral</Badge>
                }
              </h4>
              {data.first_webhook?.raw_snippet ? (
                <pre className="p-3 bg-[#0d0d0f] border border-[#222225] rounded-xl text-[9px] text-slate-500 font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto custom-scrollbar">
                  {data.first_webhook.raw_snippet}
                </pre>
              ) : (
                <div className="p-3 bg-[#121214] border border-[#222225] rounded-xl text-[10px] text-slate-500 italic">
                  No hay payload crudo almacenado para el primer mensaje.
                </div>
              )}
            </section>

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
