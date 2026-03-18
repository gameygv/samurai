import React from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, MapPin, Target, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadRowProps {
  lead: any;
  allTags: {id: string, text: string, color: string}[];
  onClick: () => void;
}

export const LeadRow = ({ lead, allTags, onClick }: LeadRowProps) => {
  if (!lead) return null;
  const intent = (lead.buying_intent || 'BAJO').toUpperCase();
  const tags = Array.isArray(lead.tags) ? lead.tags : [];
  const tagsConfig = Array.isArray(allTags) ? allTags : [];
  
  return (
    <TableRow className="border-b border-[#161618] hover:bg-[#1a1a1d] transition-all group">
      <TableCell className="pl-6 py-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#121214] border border-[#222225] flex items-center justify-center font-bold text-indigo-400 text-sm shadow-inner shrink-0">
            {lead.nombre?.substring(0, 2).toUpperCase() || '??'}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-100 text-sm group-hover:text-indigo-300 transition-colors">{lead.nombre || 'Sin Nombre'}</span>
            <span className="text-[11px] text-slate-500 font-mono mt-0.5">{lead.telefono}</span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
             <div className={cn("flex items-center gap-1.5 text-[10px]", lead.email ? "text-emerald-400 font-bold" : "text-slate-600 italic")}>
               <Mail className="w-3 h-3" /> {lead.email || 'Sin Email'}
             </div>
             <div className={cn("flex items-center gap-1.5 text-[10px]", lead.ciudad ? "text-indigo-300 font-bold" : "text-slate-600 italic")}>
               <MapPin className="w-3 h-3" /> {lead.ciudad || 'Sin Ciudad'}
             </div>
          </div>
          
          {tags.length > 0 && (
             <div className="flex gap-1.5 flex-wrap mt-1">
                 {tags.map((t: string) => {
                     const tagConf = tagsConfig.find(lt => lt.text === t);
                     const bgColor = tagConf ? tagConf.color + '15' : '#1e293b';
                     const textColor = tagConf ? tagConf.color : '#94a3b8';
                     const borderColor = tagConf ? tagConf.color + '40' : '#334155';
                     return (
                         <Badge key={t} style={{ backgroundColor: bgColor, color: textColor, borderColor }} className="text-[8px] h-5 px-2 font-bold uppercase tracking-widest border">
                             {t}
                         </Badge>
                     );
                 })}
             </div>
          )}
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="inline-flex flex-col items-center bg-[#121214] px-4 py-1.5 rounded-xl border border-[#222225]">
           <span className="text-xs font-bold text-indigo-400 font-mono">{lead.lead_score || 0}</span>
           <span className="text-[8px] text-slate-600 uppercase font-bold tracking-widest mt-0.5">Score</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn(
          "text-[9px] uppercase font-bold tracking-widest px-3 py-1 border shadow-sm",
          intent === 'COMPRADO' ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10" :
          intent === 'ALTO' ? "border-amber-500/50 text-amber-400 bg-amber-500/10" :
          "border-[#333336] text-slate-400 bg-[#121214]"
        )}>
          {intent}
        </Badge>
      </TableCell>
      <TableCell className="text-right pr-6">
        <Button size="sm" variant="ghost" onClick={onClick} className="h-9 px-4 text-[10px] font-bold uppercase tracking-widest text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all rounded-xl border border-indigo-500/30">
          Revisar <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </TableCell>
    </TableRow>
  );
};