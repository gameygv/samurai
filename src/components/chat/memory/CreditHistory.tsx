import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Wallet, DollarSign, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CreditHistoryProps {
  contactId: string | null;
}

export const CreditHistory = ({ contactId }: CreditHistoryProps) => {
  const [sales, setSales] = useState<any[]>([]);

  useEffect(() => {
    if (!contactId) return;
    const fetchCredits = async () => {
      const { data } = await supabase
        .from('credit_sales')
        .select('id, concept, total_amount, down_payment, status, precio_tipo, installments:credit_installments(amount, status)')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });
      if (data) setSales(data);
    };
    fetchCredits();
  }, [contactId]);

  if (!contactId || sales.length === 0) return null;

  return (
    <div className="pt-2 border-t border-[#1a1a1a]">
       <div className="flex justify-between items-center py-2">
          <span className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2">
             <span className="p-1 bg-emerald-500/10 rounded-md"><Wallet className="w-3 h-3 text-emerald-400" /></span> Créditos y Pagos
          </span>
          <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-500/30 text-[9px]">{sales.length}</Badge>
       </div>
       <div className="space-y-2 mt-1">
          {sales.map((sale: any) => {
            const total = parseFloat(sale.total_amount) || 0;
            const downPayment = parseFloat(sale.down_payment) || 0;
            const paidInstallments = (sale.installments || [])
              .filter((i: any) => i.status === 'PAID')
              .reduce((sum: number, i: any) => sum + (parseFloat(i.amount) || 0), 0);
            const totalPaid = downPayment + paidInstallments;
            const remaining = Math.max(0, total - totalPaid);

            const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
              ACTIVE: { color: 'text-amber-400 bg-amber-500/15 border-amber-500/30', icon: Clock, label: 'ACTIVO' },
              COMPLETED: { color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30', icon: CheckCircle, label: 'LIQUIDADO' },
              LATE: { color: 'text-red-400 bg-red-500/15 border-red-500/30', icon: AlertTriangle, label: 'ATRASADO' },
            };
            const st = statusConfig[sale.status] || statusConfig.ACTIVE;
            const StIcon = st.icon;

            return (
              <div key={sale.id} className="p-2.5 bg-[#121214] border border-[#222225] rounded-lg space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold text-slate-200 truncate flex-1">{sale.concept || 'Venta a crédito'}</p>
                  <Badge className={`text-[8px] shrink-0 ${st.color}`}><StIcon className="w-2.5 h-2.5 mr-0.5"/>{st.label}</Badge>
                </div>
                <div className="flex items-center gap-3 text-[9px]">
                  <span className="text-slate-500">Total: <span className="text-slate-300 font-mono">${total.toLocaleString()}</span></span>
                  <span className="text-emerald-400 font-mono"><DollarSign className="w-2.5 h-2.5 inline"/>Pagado: ${totalPaid.toLocaleString()}</span>
                  {remaining > 0 && <span className="text-amber-400 font-mono">Resta: ${remaining.toLocaleString()}</span>}
                </div>
                {sale.precio_tipo && (
                  <Badge className={`text-[7px] px-1 py-0 h-3.5 ${sale.precio_tipo === 'preventa' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-slate-500/15 text-slate-400 border-slate-500/30'}`}>
                    {sale.precio_tipo === 'preventa' ? 'PREVENTA' : 'NORMAL'}
                  </Badge>
                )}
              </div>
            );
          })}
       </div>
    </div>
  );
};
