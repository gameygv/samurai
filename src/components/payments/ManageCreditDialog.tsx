import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, DollarSign, CalendarDays, Wallet, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ManageCreditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: any;
  onSuccess: () => void;
}

export const ManageCreditDialog = ({ open, onOpenChange, sale, onSuccess }: ManageCreditDialogProps) => {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  if (!sale) return null;

  const installments = (sale.installments || []).sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  
  const totalAmount = parseFloat(sale.total_amount) || 0;
  const downPayment = parseFloat(sale.down_payment) || 0;
  const paidInstallments = installments.filter((i: any) => i.status === 'PAID').reduce((sum: number, i: any) => sum + parseFloat(i.amount), 0);
  const totalPaid = downPayment + paidInstallments;
  const totalRemaining = Math.max(0, totalAmount - totalPaid);
  const progressPercent = totalAmount > 0 ? Math.min(100, Math.round((totalPaid / totalAmount) * 100)) : 0;

  const handleApplyPayment = async (e: React.FormEvent) => {
     e.preventDefault();
     let amount = parseFloat(paymentAmount);
     if (isNaN(amount) || amount <= 0) return toast.error("Ingresa un monto válido mayor a 0.");

     const pendingInsts = installments.filter((i: any) => i.status === 'PENDING' || i.status === 'LATE');
     
     if (amount > totalRemaining) {
        toast.info("El abono ingresado supera la deuda. Se ajustará al saldo pendiente exacto.");
        amount = totalRemaining;
     }

     setProcessing(true);
     const tid = toast.loading("Calculando y aplicando abono de forma inteligente...");

     try {
        let remainingToApply = amount;
        
        for (const inst of pendingInsts) {
           if (remainingToApply <= 0.01) break; // Float tolerance
           const instAmt = parseFloat(inst.amount);

           if (remainingToApply >= instAmt) {
              // Paga la cuota completa
              await supabase.from('credit_installments').update({ status: 'PAID', paid_at: new Date().toISOString() }).eq('id', inst.id);
              remainingToApply -= instAmt;
           } else {
              // Pago Parcial Inteligente: Paga lo que alcanza y crea una nueva cuota con el resto
              await supabase.from('credit_installments').update({ amount: remainingToApply, status: 'PAID', paid_at: new Date().toISOString() }).eq('id', inst.id);
              
              await supabase.from('credit_installments').insert({
                 sale_id: sale.id,
                 installment_number: inst.installment_number, // Mantiene la posición
                 amount: instAmt - remainingToApply,
                 due_date: inst.due_date,
                 status: 'PENDING'
              });
              
              remainingToApply = 0;
           }
        }

        // ¿Se liquidó la deuda total?
        if (totalRemaining - amount <= 0.01) {
            await supabase.from('credit_sales').update({ status: 'PAID' }).eq('id', sale.id);
            if (sale.contact_id) {
               await supabase.from('contacts').update({ financial_status: 'A tiempo' }).eq('id', sale.contact_id);
            }
        } else if (sale.contact_id) {
            await supabase.from('contacts').update({ financial_status: 'A tiempo' }).eq('id', sale.contact_id);
        }

        await supabase.from('activity_logs').insert({
            action: 'UPDATE', resource: 'SYSTEM',
            description: `Abono de $${amount.toLocaleString()} procesado para ${sale.contact?.nombre || 'Cliente'}. Saldo: $${Math.max(0, totalRemaining - amount).toLocaleString()}`, 
            status: 'OK'
        });

        toast.success("Pago procesado exitosamente.", { id: tid });
        setPaymentAmount('');
        onSuccess();
     } catch (err: any) {
        toast.error("Error crítico: " + err.message, { id: tid });
     } finally {
        setProcessing(false);
     }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f0f11] border-[#222225] text-white max-w-3xl rounded-3xl p-0 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <DialogHeader className="p-6 bg-[#161618] border-b border-[#222225] shrink-0">
          <div className="flex justify-between items-center">
             <div>
                <DialogTitle className="flex items-center gap-3 text-emerald-400 text-lg">
                  <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20"><Wallet className="w-5 h-5" /></div>
                  Bóveda de Pagos y Abonos
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-xs mt-1">
                   Cliente: <strong className="text-white">{sale.contact?.nombre} {sale.contact?.apellido}</strong> • {sale.concept}
                </DialogDescription>
             </div>
             {sale.status === 'PAID' && <Badge className="bg-emerald-600 text-white font-bold uppercase tracking-widest px-3 h-8 shadow-lg shadow-emerald-900/50 border-none"><CheckCircle2 className="w-4 h-4 mr-2"/> LIQUIDADO</Badge>}
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-[#0a0a0c]">
           {/* PANEL IZQUIERDO: RESUMEN Y ABONO */}
           <div className="w-full md:w-80 bg-[#121214] border-r border-[#222225] p-6 flex flex-col gap-6 shrink-0">
              
              <div className="space-y-4 bg-[#0a0a0c] p-5 rounded-2xl border border-[#222225] shadow-inner">
                 <div className="space-y-1 text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Valor Total</p>
                    <p className="text-2xl font-mono font-bold text-white">${totalAmount.toLocaleString()}</p>
                 </div>
                 
                 <div className="h-3 w-full bg-[#161618] rounded-full overflow-hidden border border-[#222225]">
                    <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${progressPercent}%` }} />
                 </div>
                 
                 <div className="flex justify-between text-xs font-mono font-bold">
                    <div className="flex flex-col text-emerald-400"><span className="text-[9px] uppercase text-emerald-500/70 font-sans tracking-widest">Pagado</span>${totalPaid.toLocaleString()}</div>
                    <div className="flex flex-col text-amber-500 items-end"><span className="text-[9px] uppercase text-amber-500/70 font-sans tracking-widest">Saldo Restante</span>${totalRemaining.toLocaleString()}</div>
                 </div>
              </div>

              {sale.status !== 'PAID' && (
                 <form onSubmit={handleApplyPayment} className="space-y-4 pt-4 border-t border-[#222225]">
                    <div className="space-y-2">
                       <Label className="text-[10px] uppercase font-bold text-emerald-400 tracking-widest ml-1">Ingresar Abono</Label>
                       <div className="relative">
                          <DollarSign className="absolute left-3 top-3.5 h-5 w-5 text-emerald-500" />
                          <Input 
                             type="number" 
                             value={paymentAmount} 
                             onChange={e => setPaymentAmount(e.target.value)} 
                             placeholder="Monto a depositar..." 
                             className="bg-[#0a0a0c] border-[#222225] pl-10 h-12 rounded-xl text-lg text-white font-bold font-mono focus-visible:ring-emerald-500" 
                             disabled={processing}
                          />
                       </div>
                       <p className="text-[9px] text-slate-500 italic leading-relaxed">El sistema cubrirá automáticamente los vencimientos más antiguos. Si el pago es menor a la cuota, la reestructurará.</p>
                    </div>
                    <Button type="submit" disabled={processing || !paymentAmount} className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest h-12 rounded-xl shadow-lg">
                       {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <CheckCircle2 className="w-4 h-4 mr-2"/>} Aplicar Pago
                    </Button>
                 </form>
              )}
           </div>

           {/* PANEL DERECHO: HISTORIAL Y VENCIMIENTOS */}
           <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 border-b border-[#222225] bg-[#161618] shrink-0 flex items-center justify-between">
                 <span className="text-xs uppercase font-bold text-slate-400 tracking-widest flex items-center gap-2"><CalendarDays className="w-4 h-4"/> Historial de Pagos</span>
              </div>
              <ScrollArea className="flex-1 custom-scrollbar">
                 <Table>
                    <TableHeader>
                       <TableRow className="border-[#222225] hover:bg-transparent">
                          <TableHead className="text-[10px] uppercase text-slate-500 font-bold sticky top-0 bg-[#161618] z-10 pl-6">Cuota / Pago</TableHead>
                          <TableHead className="text-[10px] uppercase text-slate-500 font-bold sticky top-0 bg-[#161618] z-10">Fecha Comprometida</TableHead>
                          <TableHead className="text-[10px] uppercase text-slate-500 font-bold sticky top-0 bg-[#161618] z-10">Monto</TableHead>
                          <TableHead className="text-[10px] uppercase text-slate-500 font-bold sticky top-0 bg-[#161618] z-10 text-right pr-6">Estatus</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {downPayment > 0 && (
                          <TableRow className="border-[#222225] bg-emerald-900/5">
                             <TableCell className="pl-6"><span className="text-xs font-bold text-slate-300">Enganche Inicial</span></TableCell>
                             <TableCell className="text-xs text-slate-500 font-mono">-</TableCell>
                             <TableCell className="font-mono text-xs font-bold text-emerald-400">${downPayment.toLocaleString()}</TableCell>
                             <TableCell className="text-right pr-6"><Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] h-6 px-3">PAGADO</Badge></TableCell>
                          </TableRow>
                       )}
                       {installments.map((inst: any, idx: number) => {
                          const isLate = inst.status === 'LATE' || (inst.status === 'PENDING' && new Date(inst.due_date) < new Date(new Date().toISOString().split('T')[0]));
                          return (
                          <TableRow key={inst.id} className={cn("border-[#222225] hover:bg-[#121214]", inst.status === 'PAID' ? 'opacity-60' : '')}>
                             <TableCell className="pl-6 font-mono text-xs text-slate-400">#{idx + 1}</TableCell>
                             <TableCell>
                                <span className={cn("font-mono text-xs", isLate ? "text-red-400 font-bold" : inst.status === 'PAID' ? "text-slate-500 line-through" : "text-amber-400")}>
                                   {new Date(inst.due_date).toLocaleDateString()}
                                </span>
                                {inst.paid_at && <span className="block text-[9px] text-emerald-500/70 font-mono mt-0.5">Pagado: {new Date(inst.paid_at).toLocaleDateString()}</span>}
                             </TableCell>
                             <TableCell className={cn("font-mono text-xs font-bold", inst.status === 'PAID' ? "text-slate-500" : "text-white")}>
                                ${Number(inst.amount).toLocaleString()}
                             </TableCell>
                             <TableCell className="text-right pr-6">
                                <Badge variant="outline" className={cn(
                                   "text-[9px] uppercase font-bold tracking-widest h-6 px-3",
                                   inst.status === 'PAID' ? "border-emerald-500/30 text-emerald-500 bg-transparent" :
                                   isLate ? "border-red-500/50 text-red-400 bg-red-500/10" : "border-amber-500/50 text-amber-400 bg-amber-500/10"
                                )}>
                                   {inst.status === 'PAID' ? 'PAGADO' : isLate ? 'ATRASADO' : 'PENDIENTE'}
                                </Badge>
                             </TableCell>
                          </TableRow>
                       )})}
                    </TableBody>
                 </Table>
              </ScrollArea>
           </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};