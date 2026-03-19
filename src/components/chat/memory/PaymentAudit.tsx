"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaymentAuditProps {
  paymentStatus: string;
  onUpdateStatus: (status: string) => void;
}

export const PaymentAudit = ({ paymentStatus, onUpdateStatus }: PaymentAuditProps) => {
  return (
    <div className="p-5 border-b border-[#1a1a1a] space-y-4">
       <h4 className="text-[10px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center gap-2">
          <Wallet className="w-3.5 h-3.5 text-[#7A8A9E]" /> Auditoría de Pago
       </h4>
       <div className="bg-[#121214] border border-[#222225] rounded-xl p-4 space-y-4">
          <div className="flex justify-between items-center">
             <span className="text-[10px] text-[#7A8A9E]">Dictamen IA:</span>
             <Badge variant="outline" className={cn(
                "text-[9px] border-[#222225] h-5 px-2 font-bold tracking-widest uppercase", 
                paymentStatus === 'VALID' ? 'bg-emerald-900/20 text-emerald-500 border-emerald-500/30' : 
                paymentStatus === 'INVALID' ? 'bg-red-900/20 text-red-500 border-red-500/30' :
                'bg-[#0a0a0c] text-[#7A8A9E]'
             )}>
                {paymentStatus === 'VALID' ? 'APROBADO' : paymentStatus === 'INVALID' ? 'RECHAZADO' : 'SIN COMPROBANTE'}
             </Badge>
          </div>
          <div className="flex gap-3">
             <Button onClick={() => onUpdateStatus('VALID')} variant="outline" size="sm" className="flex-1 h-8 bg-transparent border-emerald-900/50 text-emerald-500 hover:bg-emerald-950/30 text-[10px] uppercase font-bold tracking-widest">Validar</Button>
             <Button onClick={() => onUpdateStatus('INVALID')} variant="outline" size="sm" className="flex-1 h-8 bg-transparent border-red-900/50 text-red-500 hover:bg-red-950/30 text-[10px] uppercase font-bold tracking-widest">Denegar</Button>
          </div>
       </div>
    </div>
  );
};