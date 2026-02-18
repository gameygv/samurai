import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BrainCircuit, Edit2, X, Save, Loader2, Bot, TrendingUp, AlertCircle, RotateCcw } from 'lucide-react';

interface MemoryPanelProps {
  currentAnalysis: any;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  memoryForm: any;
  setMemoryForm: (val: any) => void;
  onSave: () => void;
  saving: boolean;
  onOpenReport: () => void;
  onReset: () => void;
}

export const MemoryPanel = ({
  currentAnalysis, isEditing, setIsEditing,
  memoryForm, setMemoryForm, onSave, saving,
  onOpenReport, onReset
}: MemoryPanelProps) => {

  const getMoodColor = (mood: string) => {
    const m = mood?.toUpperCase() || 'NEUTRO';
    if (m.includes('ENOJADO')) return 'text-red-500 border-red-500/50 bg-red-500/10';
    if (m.includes('FELIZ')) return 'text-green-500 border-green-500/50 bg-green-500/10';
    return 'text-slate-400 border-slate-700 bg-slate-800';
  };

  const getIntentColor = (intent: string) => {
    const i = intent?.toUpperCase() || 'BAJO';
    if (i === 'ALTO') return 'bg-green-600';
    if (i === 'MEDIO') return 'bg-yellow-500';
    return 'bg-slate-600';
  };

  return (
    <div className="w-[280px] bg-slate-900/30 flex flex-col overflow-y-auto border-l border-slate-800">
      <div className="p-4 space-y-6">

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <BrainCircuit className="w-3 h-3" /> Memoria Viva
          </h4>
          {!isEditing ? (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-white" onClick={() => setIsEditing(true)}>
              <Edit2 className="w-3 h-3" />
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-300" onClick={() => setIsEditing(false)}>
                <X className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-green-400 hover:text-green-300" onClick={onSave} disabled={saving}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              </Button>
            </div>
          )}
        </div>

        {/* 1. ANÁLISIS PSICOLÓGICO */}
        <Card className="bg-slate-950 border-slate-800 shadow-none">
          <CardContent className="p-3 space-y-4">
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-400 block uppercase tracking-wide">Estado Emocional</Label>
              {isEditing ? (
                <Select value={memoryForm.mood} onValueChange={v => setMemoryForm({ ...memoryForm, mood: v })}>
                  <SelectTrigger className="h-7 text-xs bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 text-white">
                    <SelectItem value="NEUTRO">Neutro</SelectItem>
                    <SelectItem value="FELIZ">Feliz / Satisfecho</SelectItem>
                    <SelectItem value="ENOJADO">Enojado / Molesto</SelectItem>
                    <SelectItem value="PRAGMATICO">Pragmático</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline" className={`w-full justify-center py-1 ${getMoodColor(currentAnalysis?.mood)}`}>
                  {currentAnalysis?.mood || 'NEUTRO'}
                </Badge>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400 uppercase tracking-wide">
                <Label>Intención Compra</Label>
              </div>
              {isEditing ? (
                <Select value={memoryForm.buying_intent} onValueChange={v => setMemoryForm({ ...memoryForm, buying_intent: v })}>
                  <SelectTrigger className="h-7 text-xs bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 text-white">
                    <SelectItem value="ALTO">Alta</SelectItem>
                    <SelectItem value="MEDIO">Media</SelectItem>
                    <SelectItem value="BAJO">Baja</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Probabilidad</span>
                    <span className={currentAnalysis?.buying_intent === 'ALTO' ? 'text-green-500 font-bold' : ''}>
                      {currentAnalysis?.buying_intent || 'BAJA'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getIntentColor(currentAnalysis?.buying_intent)}`}
                      style={{ width: currentAnalysis?.buying_intent === 'ALTO' ? '90%' : currentAnalysis?.buying_intent === 'MEDIO' ? '50%' : '20%' }}
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 2. RESUMEN EJECUTIVO */}
        <div>
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
            <Bot className="w-3 h-3" /> Resumen Contextual
          </h4>
          {isEditing ? (
            <Textarea
              value={memoryForm.summary}
              onChange={e => setMemoryForm({ ...memoryForm, summary: e.target.value })}
              className="bg-slate-950 border-slate-700 text-xs min-h-[150px] leading-relaxed font-mono"
              placeholder="Escribe lo que la IA debe recordar..."
            />
          ) : (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 relative group">
              <p className="text-xs text-slate-300 italic leading-relaxed">
                "{currentAnalysis?.summary || 'Esperando análisis suficiente para generar resumen...'}"
              </p>
            </div>
          )}
        </div>

        {/* 3. ACCIONES SUGERIDAS */}
        {!isEditing && (
          <div className="pt-4 border-t border-slate-800/50">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <TrendingUp className="w-3 h-3" /> Acciones Rápidas
            </h4>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-[10px] h-8 border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white"
                onClick={onOpenReport}
              >
                <AlertCircle className="w-3 h-3 mr-2 text-yellow-500" /> Comando #CIA
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-[10px] h-8 border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white"
                onClick={onReset}
              >
                <RotateCcw className="w-3 h-3 mr-2 text-blue-500" /> Resetear Memoria
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};