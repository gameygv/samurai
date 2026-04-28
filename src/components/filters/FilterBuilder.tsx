import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Filter, Users, Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export interface FilterRule {
  id: string;
  field: string;
  op: string;
  value: string;
}

interface FilterBuilderProps {
  onFilterChange?: (rules: FilterRule[]) => void;
  onLeadIds?: (ids: string[]) => void;
  /** When true, skip server-side evaluate-segment (parent handles filtering) */
  clientSideOnly?: boolean;
  /** Matched count shown externally (for client-side mode) */
  externalCount?: number | null;
}

const FIELD_GROUPS = [
  {
    label: 'Contacto',
    fields: [
      { value: 'nombre', label: 'Nombre' },
      { value: 'telefono', label: 'Teléfono' },
      { value: 'email', label: 'Email' },
      { value: 'ciudad', label: 'Ciudad' },
      { value: 'genero', label: 'Género' },
      { value: 'tags', label: 'Etiquetas' },
    ],
  },
  {
    label: 'Academia',
    fields: [
      { value: 'grupo_whatsapp', label: 'Grupo de WhatsApp' },
      { value: 'profesor', label: 'Profesor' },
      { value: 'sede', label: 'Sede' },
      { value: 'nivel_curso', label: 'Nivel de Curso' },
    ],
  },
  {
    label: 'Lead',
    fields: [
      { value: 'buying_intent', label: 'Nivel de Interés' },
      { value: 'confidence_score', label: 'Score' },
      { value: 'origen', label: 'Origen' },
      { value: 'estado_emocional_actual', label: 'Estado Emocional' },
      { value: 'ai_paused', label: 'IA Pausada' },
    ],
  },
];

const ALL_FIELDS = FIELD_GROUPS.flatMap(g => g.fields);

const OPS = [
  { value: 'contains', label: 'contiene' },
  { value: 'eq', label: 'es igual a' },
  { value: 'neq', label: 'no es igual a' },
  { value: 'gt', label: 'mayor que' },
  { value: 'lt', label: 'menor que' },
  { value: 'is_null', label: 'está vacío' },
  { value: 'not_null', label: 'no está vacío' },
];

// Fields that have fixed or fetchable suggestions
const SUGGESTION_FIELDS = ['genero', 'nivel_curso', 'buying_intent'];
const ASYNC_SUGGESTION_FIELDS = ['profesor', 'sede', 'grupo_whatsapp', 'tags'];

const FIXED_SUGGESTIONS: Record<string, string[]> = {
  genero: ['Hombre', 'Mujer', 'Otro'],
  nivel_curso: ['Basico', 'Intermedio', 'Avanzado'],
  buying_intent: ['NUEVO', 'INTERESADO', 'NEGOCIANDO', 'COMPRADO', 'PERDIDO'],
};

export const FilterBuilder = ({ onFilterChange, onLeadIds, clientSideOnly, externalCount }: FilterBuilderProps) => {
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});

  // Fetch async suggestions on mount
  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    const newSuggestions: Record<string, string[]> = {};

    // Fetch distinct profesores from courses
    const { data: courses } = await supabase.from('courses').select('profesor, sede').not('profesor', 'is', null);
    if (courses) {
      newSuggestions.profesor = [...new Set(courses.map(c => c.profesor).filter(Boolean))] as string[];
      newSuggestions.sede = [...new Set(courses.map(c => c.sede).filter(Boolean))] as string[];
    }

    // Fetch distinct group names from cache
    const { data: groups } = await supabase.from('whatsapp_groups_cache').select('name').eq('is_active', true);
    if (groups) {
      newSuggestions.grupo_whatsapp = [...new Set(groups.map(g => g.name).filter(Boolean))] as string[];
    }

    // Fetch tags from app_config
    const { data: tagConfigs } = await supabase.from('app_config').select('key, value').or('key.eq.global_tags,key.like.agent_tags_%');
    if (tagConfigs) {
      const allTags = new Set<string>();
      tagConfigs.forEach(tc => {
        try {
          const parsed = JSON.parse(tc.value);
          if (Array.isArray(parsed)) parsed.forEach((t: any) => { if (t.text) allTags.add(t.text); });
        } catch {}
      });
      newSuggestions.tags = [...allTags];
    }

    setSuggestions(newSuggestions);
  };

  const addRule = () => {
    setRules(prev => [...prev, {
      id: Date.now().toString(),
      field: 'nombre',
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

  // Server-side evaluate (only when NOT in clientSideOnly mode)
  const evaluate = useCallback(async () => {
    if (clientSideOnly || rules.length === 0) {
      setPreviewCount(null);
      return;
    }

    // Only evaluate server-side fields
    const serverFields = new Set(['ciudad', 'buying_intent', 'nombre', 'telefono', 'email', 'confidence_score', 'origen', 'genero', 'estado_emocional_actual', 'ai_paused']);
    const validRules = rules.filter(r => serverFields.has(r.field) && r.op && (r.value || r.op === 'is_null' || r.op === 'not_null'));
    if (validRules.length === 0) { setPreviewCount(null); return; }

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
  }, [rules, clientSideOnly]);

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

  const getSuggestionsForField = (field: string): string[] => {
    if (FIXED_SUGGESTIONS[field]) return FIXED_SUGGESTIONS[field];
    if (suggestions[field]) return suggestions[field];
    return [];
  };

  const hasSuggestions = (field: string) => SUGGESTION_FIELDS.includes(field) || ASYNC_SUGGESTION_FIELDS.includes(field);

  const displayCount = clientSideOnly ? externalCount : previewCount;

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
        <p className="text-xs text-slate-600 text-center py-4">Agrega reglas para filtrar contactos</p>
      )}

      {rules.map(rule => {
        const fieldSuggestions = getSuggestionsForField(rule.field);
        const showSuggestions = hasSuggestions(rule.field) && rule.op !== 'is_null' && rule.op !== 'not_null';

        return (
          <div key={rule.id} className="flex items-center gap-2">
            <Select value={rule.field} onValueChange={v => updateRule(rule.id, { field: v, value: '' })}>
              <SelectTrigger className="bg-[#121214] border-[#222225] text-xs h-9 w-[160px] rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-100 rounded-xl">
                {FIELD_GROUPS.map(group => (
                  <React.Fragment key={group.label}>
                    <div className="px-2 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest">{group.label}</div>
                    {group.fields.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </React.Fragment>
                ))}
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
              showSuggestions && fieldSuggestions.length > 0 ? (
                <Select value={rule.value} onValueChange={v => updateRule(rule.id, { value: v })}>
                  <SelectTrigger className="bg-[#121214] border-[#222225] text-xs h-9 flex-1 rounded-lg">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-100 rounded-xl max-h-[300px]">
                    {fieldSuggestions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={rule.value}
                  onChange={e => updateRule(rule.id, { value: e.target.value })}
                  placeholder="valor..."
                  className="bg-[#121214] border-[#222225] text-xs h-9 flex-1 rounded-lg"
                />
              )
            )}

            <Button variant="ghost" size="icon" onClick={() => removeRule(rule.id)} className="h-8 w-8 text-slate-500 hover:text-red-400 shrink-0">
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        );
      })}

      {rules.length > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-[#222225]">
          <div className="flex items-center gap-2">
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
            ) : displayCount !== null && displayCount !== undefined ? (
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                <Users className="w-3 h-3 mr-1" /> {displayCount} contactos
              </Badge>
            ) : null}
          </div>
          {onLeadIds && !clientSideOnly && (
            <Button variant="outline" size="sm" onClick={getLeadIds} className="text-[10px] uppercase tracking-widest font-bold h-7 border-indigo-500/30 text-indigo-400">
              Usar selección
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
