import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, DollarSign, CalendarDays, Wallet, User, Save, 
  ListChecks, Calculator, ChevronRight, BellRing, MessageSquare, AlertTriangle, ShieldAlert,
  ArrowRight, Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreateCreditSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: any;
  onSuccess: () => void;
}

export const CreateCreditSaleDialog = ({ open, onOpenChange, contact, onSuccess }: CreateCreditSaleDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [agents, setAgents] = useState<any[]>([]);

  // STEP 1: Configuración de la Venta
  const [concept, setConcept] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const [frequency, setFrequency] = useState('MENSUAL');
  const [numberOfPayments, setNumberOfPayments] = useState('1');
  const [startDate, setStartDate] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('1'); 
  
  // STEP 2: Parcialidades Generadas
  const [installments, setInstallments] = useState<{ id: string; amount: string; date: string; }[]>([]);

  // STEP 3: Timeline de Notificaciones (A, B, C, D)
  const [seqPreDays, setSeqPreDays] = useState('1');
  const [seqPost1Days, setSeqPost1Days] = useState('1');
  const [seqPost2Days, setSeqPost2Days] = useState('8');
  const [seqAbandonDays, setSeqAbandonDays] = useState('15');

  const [msgPre, setMsgPre] = useState('👋 Hola {nombre}, te recordamos amablemente que mañana vence tu pago de *${monto}*. Cualquier duda, estamos a tu disposición.');
  const [msgPost1, setMsgPost1] = useState('⚠️ Hola {nombre}, notamos que tu pago de *${monto}* venció ayer. ¿Tuviste algún contratiempo?');
  const [msgPost2, setMsgPost2] = useState('🚨 Hola {nombre}, tu pago de *${monto}* tiene una semana de atraso. Por favor contáctanos urgente para evitar penalizaciones.');
  const [msgAbandonAgent, setMsgAbandonAgent] = useState('🚨 ALERTA CRÍTICA: El cliente *{nombre}* no ha respondido ni pagado y superó el límite. El sistema lo ha marcado como ABANDONADO automáticamente. Se requiere acción humana/legal inmediata.');

  useEffect(() => {
    if (open) {
      setStep(1);
      setConcept(''); setTotalAmount(''); setDownPayment(''); setInstallments([]); setNumberOfPayments('1');
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today);
      fetchAgents();
    }
  }, [open]);

  const fetchAgents = async () => {
     const { data } = await supabase.from('profiles').select('id, full_name, role').in('role', ['admin', 'dev', 'gerente']);
     if (data) setAgents(data);
  };

  const getFinancedAmount = () => {
     const total = parseFloat(totalAmount) || 0;
     const abono = parseFloat(downPayment) || 0;
     return Math.max(0, total - abono);
  };

  const handleGeneratePlan = () => {
      const financed = getFinancedAmount();
      const payments = parseInt(numberOfPayments);
      
      if (financed <= 0) return toast.error("El monto a financiar debe ser mayor a 0.");
      if (isNaN(payments) || payments <= 0) return toast.error("El número de pagos debe ser mayor a 0.");
      if (!startDate) return toast.error("Selecciona una fecha de inicio.");

      const amountPerPayment = (financed / payments).toFixed(2);
      const generated = [];
      let currentDate = new Date(startDate);

      for (let i = 0; i < payments; i++) {
          if (i > 0) {
             if (frequency === 'MENSUAL') {
                 currentDate.setMonth(currentDate.getMonth() + 1);
                 const targetDay = parseInt(dayOfMonth);
                 const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
                 currentDate.setDate(Math.min(targetDay, lastDayOfMonth));
             } else if (frequency === 'QUINCENAL') {
                 const currentDay = currentDate.getDate();
                 if (currentDay <= 15) currentDate.setDate(currentDate.getDate() + 15);
                 else { currentDate.setMonth(currentDate.getMonth() + 1); currentDate.setDate(1); }
             } else if (frequency === 'SEMANAL') {
                 currentDate.setDate(currentDate.getDate() + 7);
             }
          }

          generated.push({ id: `temp-${i}`, amount: amountPerPayment, date: currentDate.toISOString().split('T')[0] });
      }

      setInstallments(generated);
      setStep(2);
  };

  const handleUpdateInstallment = (index: number, field: string, value: string) => {
      const newInst = [...installments];
      newInst[index] = { ...newInst[index], [field]: value };
      setInstallments(newInst);
  };

  const handleSaveSale = async () => {
      if (!concept) return toast.error("El concepto es obligatorio.");
      if (!responsibleId) return toast.error("Debes asignar un responsable de cobranza.");

      const financed = getFinancedAmount();
      const sum = installments.reduce((acc, curr) => acc + parseFloat(curr.amount || '0'), 0);
      if (Math.abs(sum - financed) > 1) {
          return toast.error(`La suma de las parcialidades ($${sum}) no coincide con el saldo a financiar ($${financed}).`);
      }

      setLoading(true);
      try {
          // 1. Crear Venta Maestra
          const { data: sale, error: saleError } = await supabase.from('credit_sales').insert({
              contact_id: contact.id,
              responsible_id: responsibleId,
              concept: concept,
              total_amount: parseFloat(totalAmount),
              down_payment: parseFloat(downPayment) || 0,
              
              seq_pre_days: parseInt(seqPreDays) || 1,
              seq_post1_days: parseInt(seqPost1Days) || 1,
              seq_post2_days: parseInt(seqPost2Days) || 8,
              seq_abandon_days: parseInt(seqAbandonDays) || 15,
              
              msg_pre: msgPre,
              msg_post1: msgPost1,
              msg_post2: msgPost2,
              msg_abandon_agent: msgAbandonAgent
          }).select().single();

          if (saleError) throw saleError;

          // 2. Insertar Parcialidades
          const installmentsData = installments.map((inst, idx) => ({
              sale_id: sale.id,
              installment_number: idx + 1,
              amount: parseFloat(inst.amount),
              due_date: inst.date
          }));

          const { error: instError } = await supabase.from('credit_installments').insert(installmentsData);
          if (instError) throw instError;

          toast.success("Crédito registrado y Motor A/B/C/D programado exitosamente.");
          onSuccess();
          onOpenChange(false);
      } catch (err: any) {
          toast.error("Error al registrar: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f0f11] border-[#222225] text-white max-w-4xl rounded-3xl p-0 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <DialogHeader className="p-6 bg-[#161618] border-b border-[#222225] shrink-0">
          <div className="flex justify-between items-center">
             <div>
                <DialogTitle className="flex items-center gap-3 text-amber-500 text-lg">
                  <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20"><Wallet className="w-5 h-5" /></div>
                  Aperturar Venta a Crédito
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-xs mt-1">
                   Cliente: <strong className="text-white">{contact?.nombre} {contact?.apellido}</strong>
                </DialogDescription>
             </div>
             <div className="flex gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${step >= 1 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-slate-700'}`} />
                <div className={`w-2.5 h-2.5 rounded-full ${step >= 2 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-slate-700'}`} />
                <div className={`w-2.5 h-2.5 rounded-full ${step >= 3 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-slate-700'}`} />
             </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 bg-[#0a0a0c] p-6">
            {/* --- PASO 1: DATOS GENERALES --- */}
            {step === 1 && (
               <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                     <div className="space-y-2 lg:col-span-3">
                        <Label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Concepto de Venta</Label>
                        <Input value={concept} onChange={e => setConcept(e.target.value)} placeholder="Ej: Tratamiento 6 Meses, Terreno, Equipo..." className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 focus-visible:ring-amber-500" />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Valor Total ($)</Label>
                        <div className="relative">
                           <DollarSign className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                           <Input type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} placeholder="65000" className="bg-[#161618] border-[#222225] pl-10 h-11 rounded-xl text-white font-bold focus-visible:ring-amber-500" />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-emerald-500 ml-1">Abono Inicial / Enganche</Label>
                        <div className="relative">
                           <DollarSign className="absolute left-3 top-3.5 h-4 w-4 text-emerald-500" />
                           <Input type="number" value={downPayment} onChange={e => setDownPayment(e.target.value)} placeholder="15000" className="bg-[#161618] border-emerald-900/50 pl-10 h-11 rounded-xl text-emerald-400 font-bold focus-visible:ring-emerald-500" />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-indigo-400 ml-1">Saldo a Financiar</Label>
                        <div className="h-11 rounded-xl bg-indigo-950/20 border border-indigo-500/30 flex items-center px-4">
                           <span className="text-indigo-400 font-bold font-mono text-lg">${getFinancedAmount().toLocaleString()}</span>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-2">
                     <Label className="text-[10px] uppercase font-bold text-amber-500 flex items-center gap-1.5 ml-1"><User className="w-3.5 h-3.5"/> Responsable de Cobranza (Gestor)</Label>
                     <Select value={responsibleId} onValueChange={setResponsibleId}>
                        <SelectTrigger className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200"><SelectValue placeholder="Seleccionar un gerente o admin..."/></SelectTrigger>
                        <SelectContent className="bg-[#121214] border-[#222225] text-white">
                           {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name} ({a.role})</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>

                  <div className="p-5 bg-[#121214] border border-[#222225] rounded-2xl space-y-4">
                     <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4"><Calculator className="w-4 h-4 text-amber-500"/> Dividir Saldo en Parcialidades</h4>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                           <Label className="text-[9px] uppercase font-bold text-slate-500 ml-1">Número de Pagos</Label>
                           <Input type="number" min="1" value={numberOfPayments} onChange={e => setNumberOfPayments(e.target.value)} className="bg-[#0a0a0c] border-[#222225] h-10 rounded-xl text-center font-bold font-mono" />
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[9px] uppercase font-bold text-slate-500 ml-1">Frecuencia</Label>
                           <Select value={frequency} onValueChange={setFrequency}>
                              <SelectTrigger className="bg-[#0a0a0c] border-[#222225] h-10 rounded-xl text-xs"><SelectValue/></SelectTrigger>
                              <SelectContent className="bg-[#0a0a0c] border-[#222225] text-white text-xs">
                                 <SelectItem value="MENSUAL">Mensual</SelectItem>
                                 <SelectItem value="QUINCENAL">Quincenal (1 y 15)</SelectItem>
                                 <SelectItem value="SEMANAL">Semanal</SelectItem>
                                 <SelectItem value="CUSTOM">Personalizado</SelectItem>
                              </SelectContent>
                           </Select>
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[9px] uppercase font-bold text-slate-500 ml-1">Día Fijo (Mensual)</Label>
                           <Input type="number" min="1" max="31" value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} disabled={frequency !== 'MENSUAL'} className="bg-[#0a0a0c] border-[#222225] h-10 rounded-xl text-center disabled:opacity-30" />
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[9px] uppercase font-bold text-slate-500 ml-1">Fecha Primer Pago</Label>
                           <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-[#0a0a0c] border-[#222225] h-10 rounded-xl text-xs text-amber-500" />
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {/* --- PASO 2: PARCIALIDADES --- */}
            {step === 2 && (
               <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                  <div className="flex justify-between items-center bg-[#121214] p-4 rounded-xl border border-[#222225]">
                     <div className="space-y-1">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Resumen de Plan</p>
                        <p className="text-sm font-bold text-white">{concept}</p>
                     </div>
                     <div className="text-right space-y-1">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Saldo a Financiar</p>
                        <p className="text-lg font-mono font-bold text-emerald-400">${getFinancedAmount().toLocaleString()}</p>
                     </div>
                  </div>

                  <div className="border border-[#222225] rounded-2xl overflow-hidden bg-[#161618]">
                     <div className="bg-[#222225]/50 p-3 border-b border-[#222225] flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><ListChecks className="w-4 h-4"/> Tabla de Amortización (Editable)</span>
                     </div>
                     <div className="h-64 overflow-y-auto custom-scrollbar">
                        <Table>
                           <TableHeader>
                              <TableRow className="border-[#222225] hover:bg-transparent">
                                 <TableHead className="text-[9px] uppercase text-slate-500 font-bold">Pago #</TableHead>
                                 <TableHead className="text-[9px] uppercase text-slate-500 font-bold">Fecha de Vencimiento</TableHead>
                                 <TableHead className="text-[9px] uppercase text-slate-500 font-bold text-right">Monto ($)</TableHead>
                              </TableRow>
                           </TableHeader>
                           <TableBody>
                              {installments.map((inst, idx) => (
                                 <TableRow key={inst.id} className="border-[#222225] hover:bg-[#121214]">
                                    <TableCell className="font-mono text-xs text-slate-400">{idx + 1}</TableCell>
                                    <TableCell>
                                       <Input type="date" value={inst.date} onChange={e => handleUpdateInstallment(idx, 'date', e.target.value)} className="bg-[#0a0a0c] border-[#222225] h-8 text-xs text-indigo-300 w-40" />
                                    </TableCell>
                                    <TableCell className="text-right">
                                       <div className="flex justify-end">
                                          <Input type="number" value={inst.amount} onChange={e => handleUpdateInstallment(idx, 'amount', e.target.value)} className="bg-[#0a0a0c] border-[#222225] h-8 text-xs font-mono text-emerald-400 text-right w-32" />
                                       </div>
                                    </TableCell>
                                 </TableRow>
                              ))}
                           </TableBody>
                        </Table>
                     </div>
                  </div>
               </div>
            )}

            {/* --- PASO 3: LÍNEA DE TIEMPO A/B/C/D (NUEVO) --- */}
            {step === 3 && (
               <div className="space-y-6 animate-in fade-in slide-in-from-right-4 max-w-3xl mx-auto">
                  <div className="text-center space-y-2">
                     <h3 className="text-lg font-bold text-white">Cronograma de Cobranza (A/B/C/D)</h3>
                     <p className="text-xs text-slate-400">Define los intervalos y mensajes automáticos. Si el cliente no paga tras el último ciclo, será etiquetado como <strong className="text-red-400">Abandonado</strong> automáticamente.</p>
                  </div>

                  <div className="relative space-y-6 pl-4 before:absolute before:inset-0 before:ml-[23px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-emerald-500/50 before:via-amber-500/50 before:to-red-500/50">
                     
                     {/* FASE A: PRE-AVISO */}
                     <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#121214] border-2 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)] text-emerald-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 font-bold text-xs">A</div>
                        <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] p-4 rounded-2xl bg-[#121214] border border-[#222225] group-hover:border-emerald-500/50 transition-colors shadow-lg">
                           <div className="flex items-center justify-between mb-3">
                              <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-widest flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> Pre-Aviso</span>
                              <div className="flex items-center gap-1.5 bg-[#0a0a0c] px-2 py-1 rounded-md border border-[#222225]">
                                 <Input type="number" min="1" value={seqPreDays} onChange={e => setSeqPreDays(e.target.value)} className="w-10 h-6 p-0 text-center bg-transparent border-0 text-[10px] font-bold text-white focus-visible:ring-0" />
                                 <span className="text-[9px] text-slate-500">días antes</span>
                              </div>
                           </div>
                           <Textarea value={msgPre} onChange={e => setMsgPre(e.target.value)} className="bg-[#0a0a0c] border-[#222225] h-20 text-[11px] rounded-xl text-slate-300 resize-none" />
                        </div>
                     </div>

                     {/* FASE B: PRIMER ATRASO */}
                     <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#121214] border-2 border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)] text-amber-400 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 font-bold text-xs">B</div>
                        <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] p-4 rounded-2xl bg-[#121214] border border-[#222225] group-hover:border-amber-500/50 transition-colors shadow-lg">
                           <div className="flex items-center justify-between mb-3">
                              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-widest flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5"/> 1er Atraso</span>
                              <div className="flex items-center gap-1.5 bg-[#0a0a0c] px-2 py-1 rounded-md border border-[#222225]">
                                 <Input type="number" min="1" value={seqPost1Days} onChange={e => setSeqPost1Days(e.target.value)} className="w-10 h-6 p-0 text-center bg-transparent border-0 text-[10px] font-bold text-white focus-visible:ring-0" />
                                 <span className="text-[9px] text-slate-500">días desp.</span>
                              </div>
                           </div>
                           <Textarea value={msgPost1} onChange={e => setMsgPost1(e.target.value)} className="bg-[#0a0a0c] border-[#222225] h-20 text-[11px] rounded-xl text-slate-300 resize-none" />
                        </div>
                     </div>

                     {/* FASE C: SEGUNDO ATRASO */}
                     <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#121214] border-2 border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)] text-orange-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 font-bold text-xs">C</div>
                        <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] p-4 rounded-2xl bg-[#121214] border border-[#222225] group-hover:border-orange-500/50 transition-colors shadow-lg">
                           <div className="flex items-center justify-between mb-3">
                              <span className="text-[10px] uppercase font-bold text-orange-500 tracking-widest flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5"/> 2do Atraso</span>
                              <div className="flex items-center gap-1.5 bg-[#0a0a0c] px-2 py-1 rounded-md border border-[#222225]">
                                 <Input type="number" min="2" value={seqPost2Days} onChange={e => setSeqPost2Days(e.target.value)} className="w-10 h-6 p-0 text-center bg-transparent border-0 text-[10px] font-bold text-white focus-visible:ring-0" />
                                 <span className="text-[9px] text-slate-500">días desp.</span>
                              </div>
                           </div>
                           <Textarea value={msgPost2} onChange={e => setMsgPost2(e.target.value)} className="bg-[#0a0a0c] border-[#222225] h-20 text-[11px] rounded-xl text-slate-300 resize-none" />
                        </div>
                     </div>

                     {/* FASE D: ABANDONADO */}
                     <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#121214] border-2 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] text-red-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 font-bold text-xs">D</div>
                        <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] p-4 rounded-2xl bg-red-950/20 border border-red-900/50 group-hover:border-red-500/50 transition-colors shadow-lg">
                           <div className="flex items-center justify-between mb-3">
                              <span className="text-[10px] uppercase font-bold text-red-500 tracking-widest flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5"/> Quiebre</span>
                              <div className="flex items-center gap-1.5 bg-[#0a0a0c] px-2 py-1 rounded-md border border-red-900/50">
                                 <Input type="number" min="3" value={seqAbandonDays} onChange={e => setSeqAbandonDays(e.target.value)} className="w-10 h-6 p-0 text-center bg-transparent border-0 text-[10px] font-bold text-red-400 focus-visible:ring-0" />
                                 <span className="text-[9px] text-slate-500">días desp.</span>
                              </div>
                           </div>
                           <p className="text-[10px] text-slate-400 mb-2">Mensaje al Gestor (El sistema etiquetará al cliente automáticamente como Abandonado):</p>
                           <Textarea value={msgAbandonAgent} onChange={e => setMsgAbandonAgent(e.target.value)} className="bg-[#0a0a0c] border-red-900/30 h-16 text-[11px] rounded-xl text-red-300 resize-none" />
                        </div>
                     </div>
                  </div>
               </div>
            )}
        </ScrollArea>

        <DialogFooter className="p-6 bg-[#161618] border-t border-[#222225] flex justify-between shrink-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="h-11 rounded-xl text-xs uppercase tracking-widest font-bold text-slate-400 hover:text-white">Cancelar</Button>
          
          <div className="flex gap-2">
             {step > 1 && <Button type="button" variant="outline" onClick={() => setStep(step - 1)} className="h-11 rounded-xl border-[#333336] bg-[#0a0a0c] font-bold text-xs uppercase tracking-widest">Atrás</Button>}
             
             {step === 1 && (
               <Button onClick={handleGeneratePlan} className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold h-11 px-8 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">
                 Calcular Plan <ArrowRight className="w-4 h-4 ml-2" />
               </Button>
             )}
             
             {step === 2 && (
               <Button onClick={() => setStep(3)} className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold h-11 px-8 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">
                 Motor Cobranza <ArrowRight className="w-4 h-4 ml-2" />
               </Button>
             )}

             {step === 3 && (
               <Button onClick={handleSaveSale} disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold h-11 px-8 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">
                 {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} ACTIVAR CRÉDITO Y AVISOS
               </Button>
             )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};