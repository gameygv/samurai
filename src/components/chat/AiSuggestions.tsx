import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AiSuggestionsProps {
  suggestions: any[];
  loading: boolean;
  onSelect: (text: string) => void;
  onRefresh: () => void;
}

export const AiSuggestions = ({ suggestions, loading, onSelect }: AiSuggestionsProps) => {
  if (loading && suggestions.length === 0) {
    return (
      <div className="flex flex-col gap-2 mb-4 px-2 w-full animate-pulse">
        {[1, 2].map(i => (
          <div key={i} className="h-10 w-full bg-slate-800/50 rounded-xl border border-slate-700/50" />
        ))}
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mb-4 px-2 w-full">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s.text)}
          className={cn(
            "text-left text-[11px] p-3 rounded-xl border transition-all hover:opacity-80 flex items-start gap-2.5",
            s.type === 'VENTA' ? 'bg-[#1a0e08] border-[#3d1c05] text-orange-400' : 
            s.type === 'EMPATIA' ? 'bg-[#0a0a1a] border-[#18183d] text-indigo-400' :
            'bg-slate-900/50 border-slate-700/50 text-slate-300'
          )}
        >
          <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="leading-relaxed">{s.text}</span>
        </button>
      ))}
    </div>
  );
};