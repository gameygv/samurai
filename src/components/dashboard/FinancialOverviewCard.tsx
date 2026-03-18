import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, TrendingUp, AlertTriangle, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface FinancialOverviewCardProps {
  stats: {
    totalCreditSales: number;
    totalCollected: number;
    totalPending: number;
    lateInstallments: number;
    activeCredits: number;
  };
}

export const FinancialOverviewCard = ({ stats }: FinancialOverviewCardProps) => {
  const navigate = useNavigate();
  
  const recoveryPercent = stats.totalCreditSales > 0 
    ? Math.round((stats.totalCollected / stats.totalCreditSales) * 100) 
    : 0;

  return (
    <Card className="bg-[#0a0a0c] border-[#1a1a1a] shadow-2xl rounded-3xl overflow-hidden hover:border-emerald-500/30 transition-colors cursor-pointer group" onClick={() => navigate('/payments')}>
      <CardHeader className="border-b border-[#1a1a1a] py-4 bg-[#0f0f11]/50">
        <div className="flex justify-between items-center">
           <CardTitle className="text-xs uppercase tracking-widest text-emerald-400 flex items-center gap-2 font-bold">
             <Wallet className="w-4 h-4" /> Estado Financiero
           </CardTitle>
           <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-[#121214] px-2 py-1 rounded-md border border-[#222225]">
             Créditos Activos: {stats.activeCredits}
           </span>
        </div>
      </CardHeader>
      <CardContent className="p-5 space-y-5">
        <div className="space-y-1">
           <div className="flex justify-between items-end">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Recuperación de Cartera</span>
              <span className="text-sm font-mono font-bold text-white">{recoveryPercent}%</span>
           </div>
           <div className="w-full h-2 bg-[#121214] rounded-full overflow-hidden border border-[#222225] shadow-inner">
              <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${recoveryPercent}%` }} />
           </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div className="bg-[#121214] border border-[#222225] rounded-2xl p-3 flex flex-col justify-center">
              <span className="text-[9px] uppercase font-bold text-emerald-500/80 tracking-widest flex items-center gap-1"><ArrowUpRight className="w-3 h-3"/> Cobrado</span>
              <span className="text-lg font-mono font-bold text-emerald-400 mt-1">${stats.totalCollected.toLocaleString()}</span>
           </div>
           <div className="bg-[#121214] border border-[#222225] rounded-2xl p-3 flex flex-col justify-center">
              <span className="text-[9px] uppercase font-bold text-amber-500/80 tracking-widest flex items-center gap-1"><ArrowDownRight className="w-3 h-3"/> Pendiente</span>
              <span className="text-lg font-mono font-bold text-amber-500 mt-1">${stats.totalPending.toLocaleString()}</span>
           </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-[#1a1a1a]">
           <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Capital Total</span>
           <span className="text-xs font-mono font-bold text-slate-300">${stats.totalCreditSales.toLocaleString()}</span>
        </div>

        {stats.lateInstallments > 0 && (
           <div className="bg-red-950/20 border border-red-900/50 p-2.5 rounded-xl flex items-center justify-between group-hover:bg-red-950/40 transition-colors">
              <div className="flex items-center gap-2">
                 <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                 <span className="text-[10px] uppercase font-bold text-red-400 tracking-widest">Cuotas Atrasadas</span>
              </div>
              <span className="text-xs font-mono font-bold text-red-500">{stats.lateInstallments}</span>
           </div>
        )}
      </CardContent>
    </Card>
  );
};