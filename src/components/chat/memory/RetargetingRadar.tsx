"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, XCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RetargetingRadarProps {
  aiPaused: boolean;
  buyingIntent: string;
  minutesSinceLastMsg: number;
  followupStage: number;
}

export const RetargetingRadar = ({ aiPaused, buyingIntent, minutesSinceLastMsg, followupStage }: RetargetingRadarProps) => {
  const isFinished = buyingIntent === 'COMPRADO' || buyingIntent === 'PERDIDO';

  return (
    <div className="p-5 border-b border-[#1a1a1a] space-y-4">
       <h4 className="text-[10px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" /> Motor de Retargeting IA
       </h4>
       <div className="bg-[#121214] border border-[#222225] rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
             <span className="text-[10px] text-slate-400">Estatus del Piloto:</span>
             {aiPaused ? (
                <Badge className="bg-red-950/40 text-red-400 border border-red-900/50 text-[9px] uppercase">
                   <XCircle className="w-3 h-3 mr-1"/> Pausado Manual
                </Badge>
             ) : isFinished ? (
                <Badge className="bg-slate-800 text-slate-400 border border-slate-700 text-[9px] uppercase">
                   <CheckCircle2 className="w-3 h-3 mr-1"/> Desactivado (Fin)
                </Badge>
             ) : (
                <Badge className="bg-indigo-900/30 text-indigo-400 border border-indigo-500/30 text-[9px] uppercase">
                   <Zap className="w-3 h-3 mr-1"/> Buscando Interacción
                </Badge>
             )}
          </div>
          
          {!aiPaused && !isFinished && (
             <>
                <div className="flex justify-between text-[10px] font-mono">
                   <span className="text-slate-500">Último mensaje:</span>
                   <span className={cn("font-bold", minutesSinceLastMsg > 60 ? "text-amber-500" : "text-slate-300")}>
                      {minutesSinceLastMsg} mins ago
                   </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-[#222225]">
                   <span className="text-[10px] text-slate-500">Fase Actual:</span>
                   <div className="flex gap-1">
                      {[0, 1, 2, 3].map(stage => (
                         <div key={stage} className={cn(
                            "w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border", 
                            followupStage === stage ? "bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : 
                            followupStage > stage ? "bg-emerald-900/30 text-emerald-400 border-emerald-500/30" : 
                            "bg-[#161618] text-slate-600 border-[#333336]"
                         )}>
                            {stage}
                         </div>
                      ))}
                   </div>
                </div>
             </>
          )}
       </div>
    </div>
  );
};