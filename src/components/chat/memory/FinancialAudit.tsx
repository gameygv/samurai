import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, ShieldCheck, AlertTriangle } from 'lucide-react';

interface FinancialAuditProps {
  status: string;
  onUpdate: (status: string) => void;
  loading: boolean;
}

export const FinancialAudit = ({ status, onUpdate, loading }: FinancialAuditProps) => (
  <div className="space-y-3">
    <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
      <CreditCard className="w-3.5 h-3.5 text-indigo-400" /> Auditoría de Pago
    </h4>
    <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl shadow-inner space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500">Dictamen IA:</span>
        {status === 'VALID' && <Badge className="bg-emerald-900/30 text-emerald-400 border-emerald-500/30 text-[9px] uppercase"><ShieldCheck className="w-3 h-3 mr-1"/> APROBADO</Badge>}
        {status === 'INVALID' && <Badge className="bg-red-900/30 text-red-400 border-red-500/30 text-[9px] uppercase"><AlertTriangle className="w-3 h-3 mr-1"/> RECHAZADO</Badge>}
        {status === 'DOUBTFUL' && <Badge className="bg-amber-900/30 text-amber-400 border-amber-500/30 text-[9px] uppercase"><AlertTriangle className="w-3 h-3 mr-1"/> DUDOSO</Badge>}
        {(!status || status === 'NONE') && <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-500">SIN COMPROBANTE</Badge>}
      </div>
      <div className="flex gap-2 pt-2 border-t border-slate-800">
        <Button size="sm" variant="outline" className="flex-1 h-7 text-[9px] border-emerald-500/30 text-emerald-500 hover:bg-emerald-900/20 rounded-lg" onClick={() => onUpdate('VALID')} disabled={loading}>VALIDAR</Button>
        <Button size="sm" variant="outline" className="flex-1 h-7 text-[9px] border-red-500/30 text-red-500 hover:bg-red-900/20 rounded-lg" onClick={() => onUpdate('INVALID')} disabled={loading}>DENEGAR</Button>
      </div>
    </div>
  </div>
);