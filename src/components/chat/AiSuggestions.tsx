import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AiSuggestionsProps {
  suggestions: any[];
  loading: boolean;
  onSelect: (text: string) => void;
  onRefresh: () => void;
}

export const AiSuggestions = ({ suggestions, loading, onSelect, onRefresh }: AiSuggestionsProps) => {
  if (loading) {
    return (
      <div className="flex gap-2 mb-2 animate-pulse px-1">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-7 w-24 bg-slate-800 rounded-full border border-slate-700" />
        ))}
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-3 px-1">
      {suggestions.map((s, i) => (
        <Button
          key={i}
          variant="outline"
          size="sm"
          className={cn(
            "h-7 text-[10px] rounded-full border-slate-700 bg-slate-900/50 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 transition-all px-3",
            s.type === 'VENTA' ? 'border-orange-500/30 text-orange-400' : 'text-slate-400'
          )}
          onClick={() => onSelect(s.text)}
        >
          {s.type === 'VENTA' && <Sparkles className="w-3 h-3 mr-1" />}
          {s.text}
        </Button>
      ))}
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-7 w-7 text-slate-600 hover:text-indigo-400" 
        onClick={onRefresh}
        title="Nuevas sugerencias"
      >
        <Sparkles className="w-3 h-3" />
      </Button>
    </div>
  );
};