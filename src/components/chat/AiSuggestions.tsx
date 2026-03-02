import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AiSuggestionsProps {
  suggestions: any[];
  loading: boolean;
  onSelect: (text: string) => void;
  onRefresh: () => void;
}

export const AiSuggestions = ({ suggestions, loading, onSelect, onRefresh }: AiSuggestionsProps) => {
  if (loading && suggestions.length === 0) {
    return (
      <div className="flex gap-2 mb-3 px-1 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 w-24 bg-slate-800 rounded-full border border-slate-700" />
        ))}
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 px-1 group">
      <div className="p-1.5 rounded-full bg-indigo-500/10 text-indigo-400">
         <Sparkles className="w-3 h-3" />
      </div>
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s.text)}
          className={cn(
            "h-7 text-[10px] font-bold rounded-full border px-3 transition-all transform hover:scale-105 active:scale-95",
            s.type === 'VENTA' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 
            s.type === 'EMPATIA' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' :
            'bg-slate-800 border-slate-700 text-slate-400'
          )}
        >
          {s.text}
        </button>
      ))}
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-7 w-7 text-slate-600 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" 
        onClick={onRefresh}
        disabled={loading}
      >
        <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
      </Button>
    </div>
  );
};