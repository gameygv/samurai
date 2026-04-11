"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Wallet, CheckCircle2, XCircle, AlertTriangle, Loader2, ShieldCheck, User, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface PaymentAuditProps {
  paymentStatus: string;
  onUpdateStatus: (status: string) => void;
  leadId?: string;
}

interface ReceiptAudit {
  id: string;
  ai_analysis: string;
  ai_verdict: string;
  matched_account: string;
  bank_detected: string;
  amount_detected: number;
  ai_note: string;
  human_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  verification_note: string;
  created_at: string;
  verifier_name?: string;
}

export const PaymentAudit = ({ paymentStatus, onUpdateStatus, leadId }: PaymentAuditProps) => {
  const { profile } = useAuth();
  const [receipts, setReceipts] = useState<ReceiptAudit[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'VALID' | 'INVALID'>('VALID');
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptAudit | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  useEffect(() => {
    if (leadId) fetchReceipts();
  }, [leadId]);

  const fetchReceipts = async () => {
    if (!leadId) return;
    setLoading(true);
    const { data } = await supabase
      .from('receipt_audits')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      // Fetch verifier names
      const verifierIds = data.filter(r => r.verified_by).map(r => r.verified_by);
      let verifierMap: Record<string, string> = {};
      if (verifierIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', verifierIds);
        if (profiles) verifierMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name]));
      }
      setReceipts(data.map(r => ({ ...r, verifier_name: r.verified_by ? verifierMap[r.verified_by] || 'Desconocido' : undefined })));
    } else {
      setReceipts([]);
    }
    setLoading(false);
  };

  const handleReanalyze = async () => {
     if (!leadId) return;
     setReanalyzing(true);
     try {
        // Traer el lead para obtener channel_id
        const { data: lead } = await supabase.from('leads').select('channel_id').eq('id', leadId).single();
        if (!lead?.channel_id) {
           toast.error('El lead no tiene canal asociado.');
           return;
        }
        // Buscar mensajes del cliente con imagen en metadata
        const { data: msgs } = await supabase
           .from('conversaciones')
           .select('id, metadata, mensaje')
           .eq('lead_id', leadId)
           .eq('emisor', 'CLIENTE')
           .order('created_at', { ascending: true });

        const imageMsgs = (msgs || []).filter((m: any) => {
           const meta = m.metadata || {};
           return meta.mediaType === 'image' && (meta.mediaUrl || meta.mediaId);
        });

        if (imageMsgs.length === 0) {
           toast.info('No hay imágenes en esta conversación para analizar.');
           return;
        }

        // Disparar analyze-receipt en paralelo por cada imagen
        let analyzed = 0;
        for (const m of imageMsgs) {
           const meta = m.metadata || {};
           try {
              const { data } = await supabase.functions.invoke('analyze-receipt', {
                 body: {
                    image_id: meta.mediaId || null,
                    media_url: meta.mediaUrl || null,
                    lead_id: leadId,
                    channel_id: lead.channel_id,
                    caption: m.mensaje || ''
                 }
              });
              if (data && !data.skipped) analyzed++;
           } catch (e) { console.error('reanalyze error:', e); }
        }

        toast.success(`Re-análisis completo: ${analyzed} comprobante(s) de ${imageMsgs.length} imagen(es).`);
        await fetchReceipts();
     } catch (err: any) {
        toast.error('Error al re-analizar: ' + err.message);
     } finally {
        setReanalyzing(false);
     }
  };

  const handleValidateClick = (receipt: ReceiptAudit, action: 'VALID' | 'INVALID') => {
    setSelectedReceipt(receipt);
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  const handleConfirmValidation = async () => {
    if (!selectedReceipt || !profile) return;
    setVerifying(true);
    try {
      await supabase.from('receipt_audits').update({
        human_verified: true,
        verified_by: profile.id,
        verified_at: new Date().toISOString(),
        verification_note: confirmAction === 'VALID' ? 'Depósito verificado como auténtico.' : 'Depósito rechazado por el agente.',
      }).eq('id', selectedReceipt.id);

      if (confirmAction === 'VALID') {
        onUpdateStatus('VALID');
      } else {
        onUpdateStatus('INVALID');
      }

      toast.success(confirmAction === 'VALID' ? 'Comprobante verificado como auténtico.' : 'Comprobante marcado como rechazado.');
      setConfirmOpen(false);
      fetchReceipts();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setVerifying(false);
    }
  };

  const verdictColor = (v: string) => {
    if (v === 'PROBABLE_VALID') return 'text-emerald-500 border-emerald-500/30 bg-emerald-900/20';
    if (v === 'PROBABLE_INVALID') return 'text-red-500 border-red-500/30 bg-red-900/20';
    return 'text-amber-400 border-amber-500/30 bg-amber-900/20';
  };

  const verdictLabel = (v: string) => {
    if (v === 'PROBABLE_VALID') return 'PROBABLE VÁLIDO';
    if (v === 'PROBABLE_INVALID') return 'PROBABLE INVÁLIDO';
    if (v === 'PENDING') return 'PENDIENTE';
    return 'NO CONCLUYENTE';
  };

  return (
    <div className="p-5 border-b border-[#1a1a1a] space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center gap-2">
          <Wallet className="w-3.5 h-3.5 text-[#7A8A9E]" /> Auditoría de Pago — Ojo de Halcón
        </h4>
        <Button
          onClick={handleReanalyze}
          disabled={reanalyzing || !leadId}
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[9px] uppercase font-bold tracking-widest text-amber-500 hover:bg-amber-950/30"
          title="Re-analizar todas las imágenes del chat"
        >
          {reanalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><RefreshCw className="w-3 h-3 mr-1" /> Re-analizar</>}
        </Button>
      </div>

      {/* Estado general */}
      <div className="bg-[#121214] border border-[#222225] rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-[#7A8A9E]">Estado del Pago:</span>
          <Badge variant="outline" className={cn(
            "text-[9px] border-[#222225] h-5 px-2 font-bold tracking-widest uppercase",
            paymentStatus === 'VALID' ? 'bg-emerald-900/20 text-emerald-500 border-emerald-500/30' :
            paymentStatus === 'INVALID' ? 'bg-red-900/20 text-red-500 border-red-500/30' :
            'bg-[#0a0a0c] text-[#7A8A9E]'
          )}>
            {paymentStatus === 'VALID' ? 'APROBADO' : paymentStatus === 'INVALID' ? 'RECHAZADO' : 'SIN COMPROBANTE'}
          </Badge>
        </div>
      </div>

      {/* Lista de comprobantes */}
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-amber-500" /></div>
      ) : receipts.length === 0 ? (
        <div className="text-[10px] text-slate-600 text-center py-2 italic">No se han detectado comprobantes en esta conversación.</div>
      ) : (
        <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
          {receipts.map((r) => (
            <div key={r.id} className="bg-[#0a0a0c] border border-[#222225] rounded-xl p-3 space-y-2">
              {/* Header: verdict + date */}
              <div className="flex justify-between items-center">
                <Badge variant="outline" className={cn("text-[8px] h-4 px-2 font-bold uppercase", verdictColor(r.ai_verdict))}>
                  {verdictLabel(r.ai_verdict)}
                </Badge>
                <span className="text-[9px] text-slate-600">
                  {new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Key data */}
              {(r.bank_detected || r.amount_detected > 0) && (
                <div className="flex gap-3 text-[10px]">
                  {r.bank_detected && <span className="text-slate-400">Banco: <strong className="text-slate-200">{r.bank_detected}</strong></span>}
                  {r.amount_detected > 0 && <span className="text-emerald-400 font-bold">${r.amount_detected.toLocaleString()}</span>}
                </div>
              )}

              {r.matched_account && r.matched_account !== 'No identificada' && (
                <div className="text-[9px] text-indigo-400">Coincide con: {r.matched_account}</div>
              )}

              {/* Analysis excerpt */}
              <div className="text-[10px] text-slate-500 italic line-clamp-3 leading-relaxed">{r.ai_analysis.substring(0, 200)}</div>

              {/* Disclaimer */}
              <div className="text-[8px] text-amber-500/60 flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5 shrink-0"/> Revisión automática IA — requiere verificación humana
              </div>

              {/* Human verification status */}
              {r.human_verified ? (
                <div className="flex items-center gap-2 p-2 bg-emerald-950/20 border border-emerald-900/30 rounded-lg">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <div className="text-[9px]">
                    <span className="text-emerald-400 font-bold">Verificado</span>
                    <span className="text-slate-400"> por </span>
                    <span className="text-slate-200 font-bold">{r.verifier_name}</span>
                    {r.verified_at && <span className="text-slate-500 ml-1">el {new Date(r.verified_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={() => handleValidateClick(r, 'VALID')} variant="outline" size="sm" className="flex-1 h-7 bg-transparent border-emerald-900/50 text-emerald-500 hover:bg-emerald-950/30 text-[9px] uppercase font-bold tracking-widest">
                    <CheckCircle2 className="w-3 h-3 mr-1"/> Validar
                  </Button>
                  <Button onClick={() => handleValidateClick(r, 'INVALID')} variant="outline" size="sm" className="flex-1 h-7 bg-transparent border-red-900/50 text-red-500 hover:bg-red-950/30 text-[9px] uppercase font-bold tracking-widest">
                    <XCircle className="w-3 h-3 mr-1"/> Denegar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-[#0f0f11] border-[#222225] text-white max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className={cn("text-sm uppercase tracking-widest font-bold flex items-center gap-2",
              confirmAction === 'VALID' ? 'text-emerald-400' : 'text-red-400'
            )}>
              {confirmAction === 'VALID' ? <CheckCircle2 className="w-5 h-5"/> : <XCircle className="w-5 h-5"/>}
              {confirmAction === 'VALID' ? 'Confirmar Validación' : 'Confirmar Rechazo'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-xs text-slate-300">
              {confirmAction === 'VALID'
                ? '¿Estás seguro de que este depósito es auténtico? Al confirmar, el pago quedará marcado como válido y tu nombre quedará registrado como verificador.'
                : '¿Estás seguro de que deseas rechazar este comprobante? Se marcará como inválido.'}
            </p>
            <div className="p-3 bg-[#161618] border border-[#222225] rounded-xl text-[10px] text-slate-400 flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-indigo-400 shrink-0"/>
              Verificado por: <strong className="text-slate-200">{profile?.full_name}</strong>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} className="rounded-xl text-[10px] uppercase font-bold">Cancelar</Button>
            <Button onClick={handleConfirmValidation} disabled={verifying}
              className={cn("rounded-xl text-[10px] uppercase font-bold px-6 h-10",
                confirmAction === 'VALID' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'
              )}>
              {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : null}
              {confirmAction === 'VALID' ? 'Sí, Validar Depósito' : 'Sí, Rechazar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
