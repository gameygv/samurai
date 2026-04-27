import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Filter, Users, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface FilterRule {
  id: string;
  field: string;
  op: string;
  value: string;
}

interface FilterBuilderProps {
  onFilterChange?: (rules: FilterRule[]) => void;
  onLeadIds?: (ids: string[]) => void;
}

const FIELDS = [
  { value: 'ciudad', label: 'Ciudad' },
  { value: 'buying_intent', label: 'Nivel de Interés' },
  { value: 'nombre', label: 'Nombre' },
  { value: 'telefono', label: 'Teléfono' },
  { value: 'email', label: 'Email' },
  { value: 'confidence_score', label: 'Score' },
  { value: 'origen', label: 'Origen' },
  { value: 'genero', label: 'Género' },
  { value: 'estado_emocional_actual', label: 'Estado Emocional' },
  { value: 'ai_paused', label: 'IA Pausada' },
];

const OPS = [
  { value: 'contains', label: 'contiene' },
  { value: 'eq', label: 'es igual a' },
  { value: 'neq', label: 'no es igual a' },
  { value: 'gt', label: 'mayor que' },
  { value: 'lt', label: 'menor que' },
  { value: 'is_null', label: 'está vacío' },
  { value: 'not_null', label: 'no está vacío' },
];

export const FilterBuilder = ({ onFilterChange, onLeadIds }: FilterBuilderProps) => {
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const addRule = () => {
    setRules(prev => [...prev, {
      id: Date.now().toString(),
      field: 'ciudad',
      op: 'contains',
      value: '',
    }]);
  };

  const removeRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const updateRule = (id: string, updates: Partial<FilterRule>) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const evaluate = useCallback(async () => {
    if (rules.length === 0) {
      setPreviewCount(null);
      return;
    }

    const validRules = rules.filter(r => r.field && r.op && (r.value || r.op === 'is_null' || r.op === 'not_null'));
    if (validRules.length === 0) return;

    setLoading(true);
    try {
      const filterJson = {
        version: 1,
        root: {
          type: 'group',
          logic: 'AND',
          rules: validRules.map(r => ({
            type: 'leaf',
            field: r.field,
            op: r.op,
            value: (r.op === 'gt' || r.op === 'lt') && r.value ? (isNaN(Number(r.value)) ? 0 : Number(r.value)) : r.value,
          })),
        },
      };

      const { data, error } = await supabase.functions.invoke('evaluate-segment', {
        body: { filter_json: filterJson, mode: 'count' },
      });

      if (!error && data) {
        setPreviewCount(data.count ?? 0);
      }
    } catch (err) {
      console.error('[FilterBuilder] evaluate error:', err);
      setPreviewCount(null);
    }
    setLoading(false);
  }, [rules]);

  // Debounce evaluate
  useEffect(() => {
    const timer = setTimeout(evaluate, 500);
    return () => clearTimeout(timer);
  }, [evaluate]);

  useEffect(() => {
    onFilterChange?.(rules);
  }, [rules, onFilterChange]);

  const getLeadIds = async () => {
    const validRules = rules.filter(r => r.field && r.op && (r.value || r.op === 'is_null' || r.op === 'not_null'));
    if (validRules.length === 0) return;

    const filterJson = {
      version: 1,
      root: {
        type: 'group',
        logic: 'AND',
        rules: validRules.map(r => ({
          type: 'leaf',
          field: r.field,
          op: r.op,
          value: (r.op === 'gt' || r.op === 'lt') && r.value ? (isNaN(Number(r.value)) ? 0 : Number(r.value)) : r.value,
        })),
      },
    };

    const { data } = await supabase.functions.invoke('evaluate-segment', {
      body: { filter_json: filterJson, mode: 'ids' },
    });

    if (data?.lead_ids) {
      onLeadIds?.(data.lead_ids);
    }
  };

  return (
    <div className="space-y-3 p-4 bg-[#0f0f11] border border-[#222225] rounded-2xl">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2">
          <Filter className="w-3 h-3" /> Filtros avanzados
        </span>
        <Button variant="ghost" size="sm" onClick={addRule} className="text-[10px] uppercase tracking-widest font-bold text-indigo-400 h-7">
          <Plus className="w-3 h-3 mr-1" /> Regla
        </Button>
      </div>

      {rules.length === 0 && (
        <p className="text-xs text-slate-600 text-center py-4">Agrega reglas para filtrar leads</p>
      )}

      {rules.map(rule => (
        <div key={rule.id} className="flex items-center gap-2">
          <Select value={rule.field} onValueChange={v => updateRule(rule.id, { field: v })}>
            <SelectTrigger className="bg-[#121214] border-[#222225] text-xs h-9 w-[140px] rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-100 rounded-xl">
              {FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={rule.op} onValueChange={v => updateRule(rule.id, { op: v })}>
            <SelectTrigger className="bg-[#121214] border-[#222225] text-xs h-9 w-[130px] rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-100 rounded-xl">
              {OPS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {rule.op !== 'is_null' && rule.op !== 'not_null' && (
            <Input
              value={rule.value}
              onChange={e => updateRule(rule.id, { value: e.target.value })}
              placeholder="valor..."
              className="bg-[#121214] border-[#222225] text-xs h-9 flex-1 rounded-lg"
            />
          )}

          <Button variant="ghost" size="icon" onClick={() => removeRule(rule.id)} className="h-8 w-8 text-slate-500 hover:text-red-400 shrink-0">
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}

      {rules.length > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-[#222225]">
          <div className="flex items-center gap-2">
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
            ) : previewCount !== null ? (
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                <Users className="w-3 h-3 mr-1" /> {previewCount} leads
              </Badge>
            ) : null}
          </div>
          {onLeadIds && (
            <Button variant="outline" size="sm" onClick={getLeadIds} className="text-[10px] uppercase tracking-widest font-bold h-7 border-indigo-500/30 text-indigo-400">
              Usar selección
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
