"use client";

import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { History, Trash2, FlaskConical, Edit2, ChevronDown, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface VersionsTabProps {
  versions: any[];
  onRefresh: () => void;
  onRestore: (snapshot: any) => void;
}

export const VersionsTab = ({ versions, onRefresh, onRestore }: VersionsTabProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleDeleteSnapshot = async (id: string) => {
    if (!confirm("¿Seguro que quieres borrar este snapshot?")) return;
    try {
      const { error } = await supabase.functions.invoke('manage-prompt-versions', {
        body: { action: 'DELETE', id }
      });
      if (error) throw error;
      toast.success("Snapshot eliminado");
      onRefresh();
    } catch (err: any) {
      toast.error("Error al eliminar");
    }
  };

  const handleRestoreClick = (snapshot: any) => {
    if (!confirm(`¿Restaurar "${snapshot.version_name}"? Esto reemplazará los prompts actuales.`)) return;
    onRestore(snapshot);
    toast.success("Snapshot cargado. Pulsa 'Aplicar Cambios' para hacerlo definitivo.");
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const isLabVersion = (v: any) => {
    return v.version_name?.startsWith('Lab') || v.notes?.startsWith('Laboratorio IA');
  };

  const getPromptKeys = (v: any): string[] => {
    if (!v.notes) return [];
    // Extraer nombres de prompts mencionados en las notas
    const match = v.notes.match(/^(?:Laboratorio IA|Edición manual): (.+?)(?:\.\n|$)/);
    if (match) return match[1].split(', ');
    return [];
  };

  const promptLabelMap: Record<string, string> = {
    'Personalidad': 'prompt_alma_samurai',
    'ADN Táctico': 'prompt_adn_core',
    'Estrategia de Cierre': 'prompt_estrategia_cierre',
    'Ojo de Halcón': 'prompt_vision_instrucciones',
    'Analista CAPI': 'prompt_analista_datos',
    'Reglas de Comportamiento': 'prompt_behavior_rules',
    'Re-learning': 'prompt_relearning',
    'Handoff Humano': 'prompt_human_handoff',
  };

  return (
    <Card className="bg-[#0f0f11] border-[#222225] flex-1 flex flex-col overflow-hidden shadow-2xl rounded-2xl min-h-0 h-full">
      <CardHeader className="shrink-0 border-b border-[#222225] p-6 bg-[#161618]">
        <CardTitle className="text-slate-50 text-sm flex items-center gap-2 uppercase tracking-widest font-bold">
          <History className="w-5 h-5 text-amber-500" /> Historial de Cambios
        </CardTitle>
      </CardHeader>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0a0a0c] p-4 space-y-3">
        {versions.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-[10px] uppercase tracking-widest font-bold">
            No hay snapshots registrados.
          </div>
        ) : versions.map(v => {
          const isLab = isLabVersion(v);
          const changedPrompts = getPromptKeys(v);
          const isExpanded = expandedId === v.id;
          // Extraer motivo del Lab si existe
          const reasonMatch = v.notes?.match(/\nMotivo: (.+)/s);
          const reason = reasonMatch ? reasonMatch[1] : null;

          return (
            <div key={v.id} className={cn(
              "rounded-xl border transition-colors",
              isLab ? "border-amber-500/20 bg-amber-950/10" : "border-[#222225] bg-[#121214]"
            )}>
              {/* Header */}
              <div className="flex items-center gap-3 p-4">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  isLab ? "bg-amber-500/10" : "bg-indigo-500/10"
                )}>
                  {isLab ? <FlaskConical className="w-4 h-4 text-amber-500" /> : <Edit2 className="w-4 h-4 text-indigo-400" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded",
                      isLab ? "bg-amber-500/10 text-amber-500" : "bg-indigo-500/10 text-indigo-400"
                    )}>
                      {isLab ? 'Lab IA' : 'Manual'}
                    </span>
                    <span className="text-[10px] text-slate-500">{formatDate(v.created_at)}</span>
                  </div>

                  {changedPrompts.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {changedPrompts.map(name => (
                        <span key={name} className="text-[9px] bg-[#1a1a1d] text-slate-400 px-1.5 py-0.5 rounded font-mono">
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {(reason || v.notes) && (
                    <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-300 rounded-lg w-8 h-8" onClick={() => setExpandedId(isExpanded ? null : v.id)}>
                      <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="text-[9px] font-bold tracking-widest uppercase text-slate-300 hover:text-white h-8 px-3" onClick={() => handleRestoreClick(v)}>
                    RESTAURAR
                  </Button>
                  <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-red-500/10 hover:text-red-500 rounded-lg w-8 h-8" onClick={() => handleDeleteSnapshot(v.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Expanded: notas y motivo */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-[#222225] mt-0">
                  <div className="mt-3 space-y-2">
                    {reason && (
                      <div className="bg-amber-950/20 border border-amber-500/10 rounded-lg p-3">
                        <span className="text-[9px] text-amber-500 uppercase font-bold tracking-widest flex items-center gap-1 mb-1">
                          <FileText className="w-3 h-3" /> Motivo del cambio
                        </span>
                        <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">{reason}</p>
                      </div>
                    )}
                    {v.notes && !reason && (
                      <p className="text-[11px] text-slate-400 leading-relaxed">{v.notes}</p>
                    )}
                    {v.notes && reason && (
                      <p className="text-[10px] text-slate-500 italic">{v.notes.replace(/\nMotivo:[\s\S]*/, '')}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};
