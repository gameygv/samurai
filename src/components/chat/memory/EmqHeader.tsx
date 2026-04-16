"use client";

import React from 'react';
import { BarChart3, FileSearch, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmqHeaderProps {
  healthPercent: number;
  healthScore: number;
  capiSent: boolean;
  analyzing: boolean;
  onRunAnalysis: () => void;
  showDiagnostic?: boolean;
}

export const EmqHeader = ({ healthPercent, healthScore, capiSent, analyzing, onRunAnalysis, showDiagnostic = false }: EmqHeaderProps) => {
  return (
    <div className="p-5 border-b border-[#1a1a1a]">
      <div className="flex justify-between items-center mb-3">
         <span className="text-[9px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center gap-1.5">
            <BarChart3 className="w-3 h-3"/> Estatus de Inteligencia Meta
         </span>
         {showDiagnostic && (
           <button
              onClick={onRunAnalysis}
              disabled={analyzing}
              className="p-1.5 rounded-md bg-[#161618] border border-[#222225] hover:bg-[#222225] transition-colors"
              title="Re-analizar lead y ver diagnóstico Meta CAPI"
           >
              {analyzing ? <Loader2 className="w-3 h-3 text-amber-500 animate-spin" /> : <FileSearch className="w-3 h-3 text-amber-500" />}
           </button>
         )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-[#161618] rounded-full overflow-hidden">
          <div className={cn("h-full transition-all duration-1000", healthPercent > 70 ? 'bg-emerald-500' : healthPercent > 40 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${healthPercent}%` }} />
        </div>
        <div className="flex items-center gap-2">
           <span className="text-[10px] font-mono font-bold text-amber-500">{healthScore}/5</span>
           {capiSent ? (
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" title="Evento Lead ya enviado a Meta" />
           ) : (
              <div className="w-2 h-2 rounded-full bg-slate-700" title="Pendiente de CAPI (Faltan datos)" />
           )}
        </div>
      </div>
    </div>
  );
};
