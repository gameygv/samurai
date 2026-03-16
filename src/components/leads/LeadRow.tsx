import React from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, MapPin, ShieldCheck, Target, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export const LeadRow = ({ lead, onClick }: { lead: any, onClick: () => void }) => {
  const intent = (lead.buying_intent || 'BAJO').toUpperCase();
  
  return (
    <TableRow className="border-slate-800 hover:bg-slate-800/30 transition-all group">
      <TableCell className="pl-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-bold text-indigo-400 text-xs shadow-inner">
            {lead.nombre?.substring(0, 2).toUpperCase() || '??'}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-100 text-sm">{lead.nombre || 'Sin Nombre'}</span>
            <span className="text-[10px] text-slate-500 font-mono">{lead.telefono}</span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1.5">
          <div className={cn("flex items-center gap-2 text-[10px]", lead.email ? "text-emerald-400" : "text-slate-600 italic")}>
            <Mail className="w-3 h-3" /> {lead.email || 'Sin Email'}
          </div>
          <div className={cn("flex items-center gap-2 text-[10px]", lead.ciudad ? "text-slate-300" : "text-slate-600 italic")}>
            <MapPin className="w-3 h-3 text-slate-500" /> {lead.ciudad || 'Sin Ciudad'}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="inline-flex flex-col items-center bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
           <span className="text-xs font-bold text-indigo-400">{lead.lead_score || 0}</span>
           <span className="text-[8px] text-slate-600 uppercase font-bold tracking-tighter">Score</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn(
          "text-[9px] uppercase font-bold tracking-widest px-2 py-0.5",
          intent === 'COMPRADO' ? "border-emerald-500 text-emerald-400 bg-emerald-500/10" :
          intent === 'ALTO' ? "border-amber-500 text-amber-400 bg-amber-500/10" :
          "border-slate-700 text-slate-500"
        )}>
          {intent}
        </Badge>
      </TableCell>
      <TableCell className="text-right pr-6">
        <Button size="sm" variant="ghost" onClick={onClick} className="h-8 w-8 p-0 group-hover:bg-indigo-500 group-hover:text-white transition-all rounded-lg">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
};