import React from 'react';
import { Button } from '@/components/ui/button';
import { Database, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CapiStatusProps {
  healthScore: number;
  healthPercent: number;
  onRunAnalysis: () => void;
  analyzing: boolean;
}

export const CapiStatus = ({ healthScore, healthPercent, onRunAnalysis, analyzing }: CapiStatusProps) => (
  <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center shrink-0">
    <div className="flex flex-col">
      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Event Match Quality</span>
      <div className="flex items-center gap-2 mt-1">
        <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className={cn("h-full transition-all duration-1000", healthPercent > 70 ? 'bg-emerald-500' : healthPercent > 40 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${healthPercent}%` }} />
        </div>
        <span className="text-[10px] font-mono font-bold text-amber-500">{healthScore}/7</span>
      </div>
    </div>
    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-amber-500 bg-slate-900 border border-slate-800 shadow-sm rounded-lg" onClick={onRunAnalysis} disabled={analyzing}>
      {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
    </Button>
  </div>
);