"use client";

import React, { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const financialStatuses = [
  { id: 'A tiempo', color: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50', dot: 'bg-emerald-500' },
  { id: 'Atrasado', color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50', dot: 'bg-yellow-500' },
  { id: 'Muy atrasado', color: 'bg-orange-500/20 text-orange-500 border-orange-500/50', dot: 'bg-orange-500' },
  { id: 'Abandonado', color: 'bg-red-500/20 text-red-500 border-red-500/50', dot: 'bg-red-500' },
  { id: 'Sin transacción', color: 'bg-slate-500/20 text-slate-300 border-slate-500/50', dot: 'bg-slate-500' }
];

interface FinancialStatusBadgeProps {
  contactId?: string;
  leadId?: string;
  currentStatus: string;
  isManager: boolean;
  onUpdate?: () => void;
}

export const FinancialStatusBadge = ({ contactId, leadId, currentStatus, isManager, onUpdate }: FinancialStatusBadgeProps) => {
  const [updating, setUpdating] = useState(false);

  const handleUpdate = async (newStatus: string) => {
    setUpdating(true);
    try {
       if (contactId) {
          const { error } = await supabase.from('contacts').update({ financial_status: newStatus }).eq('id', contactId);
          if (error) throw error;
       } else if (leadId) {
          const { error } = await supabase.from('contacts').update({ financial_status: newStatus }).eq('lead_id', leadId);
          if (error) throw error;
       }
       toast.success("Estado financiero actualizado");
       if (onUpdate) onUpdate();
    } catch (err: any) {
       toast.error(err.message);
    } finally {
       setUpdating(false);
    }
  };

  const currentConfig = financialStatuses.find(s => s.id === currentStatus) || financialStatuses[4];

  if (!isManager) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={updating} className="outline-none">
         <Badge variant="outline" className={cn("text-[9px] uppercase font-bold flex items-center gap-1 cursor-pointer h-5", currentConfig.color, updating && "opacity-50")}>
            {updating ? <Loader2 className="w-3 h-3 animate-spin" /> : currentConfig.id}
            <ChevronDown className="w-2.5 h-2.5 opacity-70" />
         </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800 text-white min-w-[160px]">
         {financialStatuses.map(status => (
            <DropdownMenuItem key={status.id} onClick={() => handleUpdate(status.id)} className="cursor-pointer text-xs focus:bg-slate-800 focus:text-white">
               <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", status.dot)} />
                  <span>{status.id}</span>
               </div>
            </DropdownMenuItem>
         ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};