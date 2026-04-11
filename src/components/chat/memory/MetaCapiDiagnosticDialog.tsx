"use client";

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Megaphone, User, Send, Clock, AlertCircle, Target } from 'lucide-react';
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
  config: { capi_enabled_on_channel: boolean; has_pixel_id: boolean; has_access_token: boolean; test_event_code: string | null; ready_to_send: boolean };
}

export const MetaCapiDiagnosticDialog = ({ open, onOpenChange, leadId }: Props) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Diagnostic | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !leadId) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        // 1. Re-analizar lead con force=true (también disparado por el botón)
        await supabase.functions.invoke('analyze-leads', { body: { lead_id: leadId, force: true } });
        // 2. Pequeña pausa para que las escrituras en DB se vean
        await new Promise(r => setTimeout(r, 800));
        // 3. Traer diagnóstico fresco
        const { data: diagnostic, error: fnErr } = await supabase.functions.invoke('get-capi-diagnostic', { body: { lead_id: leadId } });
        if (fnErr) throw fnErr;
        if (cancelled) return;
        setData(diagnostic as Diagnostic);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Error al cargar diagnóstico');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [open, leadId]);

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
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
            <AlertCircle className="w-4 h-4 inline mr-2" />
            {error}
          </div>
        )}

        {data && !loading && (
          <div className="space-y-5 text-xs">

            {/* Estado general */}
            <section className="bg-[#121214] border border-[#222225] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#7A8A9E] uppercase tracking-widest">Lead</span>
                <Badge variant="outline" className="text-[9px] bg-indigo-950/30 text-indigo-400 border-indigo-900/50 uppercase font-bold tracking-widest">
                  {data.lead.buying_intent}
                </Badge>
              </div>
              <div className="text-sm font-bold text-slate-100">{data.lead.nombre}</div>
              <div className="text-[10px] text-slate-500">Score: <strong className="text-amber-400">{data.lead.lead_score || 0}/100</strong> · Pago: <strong className={data.lead.payment_status === 'VALID' ? 'text-emerald-400' : 'text-slate-400'}>{data.lead.payment_status || 'SIN COMPROBANTE'}</strong></div>
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
                <Megaphone className="w-3.5 h-3.5 text-amber-400" /> Atribución del anuncio {data.campaign.has_attribution ? '(CTWA)' : '(orgánico)'}
              </h4>
              {!data.campaign.has_attribution ? (
                <div className="p-3 bg-[#121214] border border-[#222225] rounded-xl text-[10px] text-slate-500 italic">
                  Este lead llegó orgánicamente (no hay click_id de anuncio). Meta no podrá atribuirlo a una campaña específica.
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
