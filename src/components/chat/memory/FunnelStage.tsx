"use client";

import React from 'react';
import { Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FunnelStageProps {
  buyingIntent: string;
  onIntentChange: (intent: string) => void;
}

export const FunnelStage = ({ buyingIntent, onIntentChange }: FunnelStageProps) => {
  return (
    <div className="p-5 border-b border-[#1a1a1a] space-y-4">
       <h4 className="text-[10px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center gap-2">
          <Target className="w-3.5 h-3.5" /> Etapa del Embudo
       </h4>
       <div className="grid grid-cols-4 gap-1 bg-[#121214] p-1 rounded-xl border border-[#222225]">
          {['BAJO', 'MEDIO', 'ALTO', 'COMPRADO'].map((intent, i) => {
             const isActive = buyingIntent === intent;
             const isLost = buyingIntent === 'PERDIDO';
             const labels = ['Hunting', 'Seducción', 'Cierre', 'Ganado'];
             const colors = ['bg-slate-700', 'bg-indigo-600', 'bg-amber-500', 'bg-emerald-500'];
             
             return (
                <button 
                   key={intent} 
                   onClick={() => onIntentChange(intent)} 
                   className={cn(
                      "relative h-8 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all", 
                      isActive ? cn(colors[i], "text-white shadow-lg") : "hover:bg-[#1a1a1d] text-slate-500", 
                      isLost && "opacity-30"
                   )}
                >
                   {labels[i]}
                </button>
             );
          })}
       </div>
       {buyingIntent === 'PERDIDO' && (
          <div className="text-center text-[10px] text-red-500 font-bold uppercase tracking-widest bg-red-950/20 py-1.5 rounded-lg border border-red-900/30">
             LEAD DESCARTADO / PERDIDO
          </div>
       )}
    </div>
  );
};