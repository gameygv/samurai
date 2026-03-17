import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, DollarSign, CalendarDays, Wallet, User, Save, ListChecks, Calculator, ChevronRight } from 'lucide-react';
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

  // Configuración de la Venta
  const [concept, setConcept] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [responsibleId, setResponsibleId] = useState('');

  // Configuración del Plan de Pagos
  const [frequency, setFrequency] = useState('MENSUAL');
  const [numberOfPayments, setNumberOfPayments] = useState('1');
  const [startDate, setStartDate] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('1'); // Para mensual
  
  // Parcialidades Generadas (Editables)
  const [installments, setInstallments] = useState<{ id: string; amount: string; date: string; }[]>([]);

  useEffect(() => {
    if (open) {
      setStep(1);
      setConcept(''); setTotalAmount(''); setInstallments([]); setNumberOfPayments('1');
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today);
      fetchAgents();
    }
  }, [open]);

  const fetchAgents = async () => {
     const { data } = await supabase.from('profiles').select('id, full_name, role').in('role', ['admin', 'dev', 'gerente']);
     if (data) setAgents(data);
  };

  const handleGeneratePlan = () => {
      const amount = parseFloat(totalAmount);
      const payments = parseInt(numberOfPayments);
      
      if (isNaN(amount) || amount <= 0) return toast.error("Ingresa un monto total válido.");
      if (isNaN(payments) || payments <= 0) return toast.error("El número de pagos debe ser mayor a 0.");
      if (!startDate) return toast.error("Selecciona una fecha de inicio.");

      const amountPerPayment = (amount / payments).toFixed(2);
      const generated = [];
      let currentDate = new Date(startDate);

      for (let i = 0; i < payments; i++) {
          if (i > 0) {
             if (frequency === 'MENSUAL') {
                 currentDate.setMonth(currentDate.getMonth() + 1);
                 // Ajustar al día configurado
                 const targetDay = parseInt(dayOfMonth);
                 const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
                 currentDate.setDate(Math.min(targetDay, lastDayOfMonth));
             } else if (frequency === 'QUINCENAL') {
                 // Lógica simple: Sumar 15 días aprox.
                 const currentDay = currentDate.getDate();
                 if (currentDay <= 15) {
                     currentDate.setDate(currentDate.getDate() + 15);
                 } else {
                     currentDate.setMonth(currentDate.getMonth() + 1);
                     currentDate.setDate(1);
                 }
             } else if (frequency === 'SEMANAL') {
                 currentDate.setDate(currentDate.getDate() + 7);
             }
          }

          generated.push({
              id: `temp-${i}`,
              amount: amountPerPayment,
              date: currentDate.toISOString().split('T')[0]
          });
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

      // Validar que la suma coincida
      const sum = installments.reduce((acc, curr) => acc + parseFloat(curr.amount || '0'), 0);
      if (Math.abs(sum - parseFloat(totalAmount)) > 1) {
          return toast.error(`La suma de las parcialidades ($${sum}) no coincide con el total ($${totalAmount}).`);
      }

      setLoading(true);
      try {
          // 1. Crear Venta Maestra
          const { data: sale, error: saleError } = await supabase.from('credit_sales').insert({
              contact_id: contact.id,
              responsible_id: responsibleId,
              concept: concept,
              total_amount: parseFloat(totalAmount)
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

          toast.success("Venta a crédito registrada correctamente. Los recordatorios automáticos han sido activados.");
          onSuccess();
          onOpenChange(false);
      } catch (err: any) {
          toast.error("Error al registrar venta: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f0f11] border-[#222225] text-white max-w-3xl rounded-3xl p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-6 bg-[#161618] border-b border-[#222225]">
          <DialogTitle className="flex items-center gap-3 text-amber-500 text-lg">
            <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20"><Wallet className="w-5 h-5" /></div>
            Aperturar Línea de Crédito
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs mt-1">
             Cliente: <strong className="text-white">{contact?.nombre} {contact?.apellido}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 bg-[#0a0a0c]">
            {step === 1 ? (
               <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
                  <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Concepto de Venta</Label>
                        <Input value={concept} onChange={e => setConcept(e.target.value)} placeholder="Ej: Cuenco Tibetano 40cm" className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 focus-visible:ring-amber-500" />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-emerald-500 ml-1">Monto Total de Deuda ($)</Label>
                        <div className="relative">
                           <DollarSign className="absolute left-3 top-3.5 h-4 w-4 text-emerald-500" />
                           <Input type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} placeholder="70000" className="bg-[#161618] border-emerald-900/50 pl-10 h-11 rounded-xl text-emerald-400 font-bold focus-visible:ring-emerald-500" />
                        </div>
                     </div>
                  </div>

                  <div className="space-y-2">
                     <Label className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1.5 ml-1"><User className="w-3.5 h-3.5"/> Responsable de Cobranza (Gestor)</Label>
                     <Select value={responsibleId} onValueChange={setResponsibleId}>
                        <SelectTrigger className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200"><SelectValue placeholder="Seleccionar un gerente o admin..."/></SelectTrigger>
                        <SelectContent className="bg-[#121214] border-[#222225] text-white">
                           {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name} ({a.role})</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>

                  <div className="p-5 bg-[#121214] border border-[#222225] rounded-2xl space-y-4">
                     <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4"><Calculator className="w-4 h-4 text-amber-500"/> Generador Bulk de Parcialidades</h4>
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
                           <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-[#0a0a0c] border-[#222225] h-10 rounded-xl text-xs text-indigo-300" />
                        </div>
                     </div>
                  </div>
               </div>
            ) : (
               <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                  <div className="flex justify-between items-center bg-[#121214] p-4 rounded-xl border border-[#222225]">
                     <div className="space-y-1">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Resumen de Plan</p>
                        <p className="text-sm font-bold text-white">{concept}</p>
                     </div>
                     <div className="text-right space-y-1">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Total a Cubrir</p>
                        <p className="text-lg font-mono font-bold text-emerald-400">${parseFloat(totalAmount).toLocaleString()}</p>
                     </div>
                  </div>

                  <div className="border border-[#222225] rounded-2xl overflow-hidden bg-[#161618]">
                     <div className="bg-[#222225]/50 p-3 border-b border-[#222225] flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><ListChecks className="w-4 h-4"/> Tabla de Amortización (Editable)</span>
                     </div>
                     <ScrollArea className="h-64">
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
                     </ScrollArea>
                  </div>
                  
                  <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 text-[10px]">
                     <CalendarDays className="w-4 h-4 shrink-0" />
                     <p>Al guardar, el sistema agendará los recordatorios para el gestor y enviará las notificaciones automáticas al cliente en las fechas establecidas.</p>
                  </div>
               </div>
            )}
        </div>

        <DialogFooter className="p-6 bg-[#161618] border-t border-[#222225]">
          {step === 1 ? (
             <>
               <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="h-11 rounded-xl">Cancelar</Button>
               <Button onClick={handleGeneratePlan} className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold h-11 px-8 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">
                 Calcular Plan <ChevronRight className="w-4 h-4 ml-2" />
               </Button>
             </>
          ) : (
             <>
               <Button type="button" variant="ghost" onClick={() => setStep(1)} className="h-11 rounded-xl">Atrás</Button>
               <Button onClick={handleSaveSale} disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold h-11 px-8 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">
                 {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} APROBAR CRÉDITO
               </Button>
             </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};