import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, ShieldX, AlertTriangle, DollarSign, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import ChatViewer from '@/components/ChatViewer';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const PendingPayments = () => {
  const { isManager } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    setLoading(true);

    // Leads con payment_status PENDING_VERIFICATION o que tienen receipt_audits sin human_verified
    const { data } = await supabase
      .from('leads')
      .select('id, nombre, telefono, ciudad, buying_intent, payment_status, last_message_at')
      .eq('payment_status', 'PENDING_VERIFICATION')
      .order('last_message_at', { ascending: false });

    if (data) {
      // Fetch receipt_audits for these leads
      const leadIds = data.map(l => l.id);
      const { data: audits } = await supabase
        .from('receipt_audits')
        .select('id, lead_id, ai_verdict, amount_detected, bank_detected, matched_account, ai_analysis, created_at, human_verified')
        .in('lead_id', leadIds.length > 0 ? leadIds : ['__none__'])
        .order('created_at', { ascending: false });

      const auditMap = new Map<string, any[]>();
      (audits || []).forEach(a => {
        if (!auditMap.has(a.lead_id)) auditMap.set(a.lead_id, []);
        auditMap.get(a.lead_id)!.push(a);
      });

      setLeads(data.map(l => ({ ...l, audits: auditMap.get(l.id) || [] })));
    }
    setLoading(false);
  };

  const handleValidate = async (lead: any) => {
    if (!confirm(`¿Confirmar pago de ${lead.nombre || lead.telefono} como válido?`)) return;
    setProcessingId(lead.id);

    // Update lead
    await supabase.from('leads').update({ payment_status: 'VALID' }).eq('id', lead.id);

    // Mark receipt_audits as human_verified
    if (lead.audits?.length > 0) {
      await supabase.from('receipt_audits').update({ human_verified: true, verified_by: 'manual' }).eq('lead_id', lead.id);
    }

    toast.success(`Pago de ${lead.nombre || lead.telefono} validado.`);
    setProcessingId(null);
    fetchPending();
  };

  const handleReject = async (lead: any) => {
    if (!confirm(`¿Rechazar pago de ${lead.nombre || lead.telefono}? El lead volverá a CIERRE.`)) return;
    setProcessingId(lead.id);

    await supabase.from('leads').update({
      payment_status: 'INVALID',
      buying_intent: 'ALTO' // Back to Cierre
    }).eq('id', lead.id);

    toast.success(`Pago de ${lead.nombre || lead.telefono} rechazado. Lead regresado a Cierre.`);
    setProcessingId(null);
    fetchPending();
  };

  if (!isManager) {
    return <Layout><div className="flex items-center justify-center h-[60vh] text-slate-500">Acceso solo para gerentes y developers.</div></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
              <DollarSign className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Pagos por Validar</h1>
              <p className="text-xs text-slate-500 mt-0.5">Comprobantes detectados por Ojo de Halcón que requieren verificación manual.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchPending} className="text-[10px] uppercase tracking-widest font-bold">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refrescar
          </Button>
        </div>

        <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-[#222225] bg-[#161618] hover:bg-[#161618]">
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest pl-6 py-4">Cliente</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Monto</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Banco</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Veredicto IA</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Cuenta</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest text-right pr-6">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="h-48 text-center"><Loader2 className="animate-spin mx-auto text-amber-500" /></TableCell></TableRow>
                ) : leads.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-48 text-center text-slate-600 italic text-xs">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500/30" />
                    No hay pagos pendientes de verificación.
                  </TableCell></TableRow>
                ) : leads.map(lead => {
                  const audit = lead.audits?.[0];
                  const isProcessing = processingId === lead.id;

                  return (
                    <TableRow key={lead.id} className="border-[#222225] hover:bg-[#1a1a1d] transition-colors">
                      <TableCell className="pl-6">
                        <button onClick={() => { setSelectedLead(lead); setIsChatOpen(true); }} className="text-left hover:text-indigo-400 transition-colors">
                          <p className="font-bold text-slate-200 text-sm">{lead.nombre || lead.telefono}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{lead.telefono}</p>
                        </button>
                      </TableCell>
                      <TableCell>
                        <span className="text-lg font-bold text-amber-400">${audit?.amount_detected?.toLocaleString() || '?'}</span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-300">{audit?.bank_detected || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-widest border-amber-500/30 text-amber-400 bg-amber-900/10">
                          <AlertTriangle className="w-3 h-3 mr-1" /> {audit?.ai_verdict === 'INCONCLUSIVE' ? 'No Concluyente' : audit?.ai_verdict || 'Pendiente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 max-w-[200px] truncate">{audit?.matched_account || 'No identificada'}</TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end items-center gap-2">
                          <Button size="sm" onClick={() => handleValidate(lead)} disabled={isProcessing}
                            className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] uppercase font-bold tracking-widest px-3 rounded-lg">
                            {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><ShieldCheck className="w-3 h-3 mr-1" /> Validar</>}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleReject(lead)} disabled={isProcessing}
                            className="h-8 border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white text-[9px] uppercase font-bold tracking-widest px-3 rounded-lg">
                            <ShieldX className="w-3 h-3 mr-1" /> Rechazar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {selectedLead && <ChatViewer lead={selectedLead} open={isChatOpen} onOpenChange={setIsChatOpen} />}
      </div>
    </Layout>
  );
};

export default PendingPayments;
