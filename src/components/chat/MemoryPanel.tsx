import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BrainCircuit, Edit2, X, Save, Loader2, Bot, TrendingUp, AlertCircle, RotateCcw, Clock, Play, Pause, ShieldAlert, Zap, Calendar, Trash2, RefreshCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MemoryPanelProps {
  currentAnalysis: any;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  memoryForm: any;
  setMemoryForm: (val: any) => void;
  onSave: () => void;
  saving: boolean;
  onReset: () => void;
  onToggleFollowup?: () => void;
}

export const MemoryPanel = ({
  currentAnalysis, isEditing, setIsEditing,
  memoryForm, setMemoryForm, onSave, saving,
  onReset, onToggleFollowup
}: MemoryPanelProps) => {

  const [correctionText, setCorrectionText] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [flushing, setFlushing] = useState(false);

  const getMoodColor = (mood: string) => {
    const m = mood?.toUpperCase() || 'NEUTRO';
    if (m.includes('ENOJADO')) return 'text-red-500 border-red-500/50 bg-red-500/10';
    if (m.includes('FELIZ')) return 'text-green-500 border-green-500/50 bg-green-500/10';
    return 'text-slate-400 border-slate-700 bg-slate-800';
  };

  const handleSaveCorrection = async () => {
    if (!correctionText.trim()) return;
    setIsReporting(true);
    try {
      const { error } = await supabase.from('errores_ia').insert({
        cliente_id: currentAnalysis.id,
        mensaje_cliente: 'Corrección manual desde Panel',
        respuesta_ia: 'N/A',
        correccion_sugerida: correctionText,
        categoria: 'CONDUCTA',
        estado_correccion: 'REPORTADA'
      });

      if (error) throw error;
      toast.success('Lección aprendida enviada a Bitácora');
      setCorrectionText('');
    } catch (err: any) {
      toast.error('Error al guardar corrección');
    } finally {
      setIsReporting(false);
    }
  };

  const handleFlushMemory = async () => {
    if (!confirm("¿Deseas borrar la memoria de este lead? Esto eliminará el resumen y el análisis emocional para que la IA lo re-analice desde cero.")) return;
    setFlushing(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          summary: null,
          estado_emocional_actual: 'NEUTRO',
          buying_intent: 'BAJO',
          last_ai_analysis: null,
          perfil_psicologico: null
        })
        .eq('id', currentAnalysis.id);

      if (error) throw error;
      toast.success('Memoria del lead reseteada correctamente.');
      window.location.reload(); // Recargar para ver cambios
    } catch (err: any) {
      toast.error('Error al resetear memoria');
    } finally {
      setFlushing(false);
    }
  };

  return (
    <div className="w-[300px] bg-slate-900/30 flex flex-col overflow-y-auto border-l border-slate-800">
      <div className="p-4 space-y-6">

        {/* 1. SECCIÓN DE MEJORA #CORREGIRIA */}
        <div className="space-y-3">
           <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-2">
                 <ShieldAlert className="w-3 h-3" /> #CorregirIA
              </h4>
           </div>
           <div className="space-y-2">
              <Textarea 
                value={correctionText}
                onChange={e => setCorrectionText(e.target.value)}
                placeholder="Escribe la observación técnica..."
                className="bg-slate-950 border-slate-800 text-xs min-h-[80px] focus:border-yellow-500/50 transition-colors"
              />
              <Button 
                onClick={handleSaveCorrection} 
                disabled={isReporting || !correctionText.trim()}
                className="w-full h-8 text-[10px] bg-yellow-600 hover:bg-yellow-700 text-white font-bold"
              >
                {isReporting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Zap className="w-3 h-3 mr-2" />}
                Guardar Observación
              </Button>
           </div>
        </div>

        {/* 2. CONTROL INDIVIDUAL DE FOLLOW-UP */}
        <div className="border-t border-slate-800 pt-6">
           <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-2 mb-4">
               <Clock className="w-3 h-3" /> Control de Follow-up
           </h4>
           
           <Card className="bg-slate-950 border-slate-800 shadow-none mb-4 overflow-hidden">
             <CardContent className="p-3 space-y-4">
                <div className="space-y-1">
                   <Label className="text-[10px] text-slate-500 uppercase">Stage Actual</Label>
                   {isEditing ? (
                      <Input 
                        type="number" 
                        value={memoryForm.followup_stage} 
                        onChange={e => setMemoryForm({...memoryForm, followup_stage: parseInt(e.target.value)})}
                        className="h-7 text-xs bg-slate-900 border-slate-700"
                      />
                   ) : (
                      <div className="text-xs text-white font-mono">STAGE {currentAnalysis.followup_stage || 0}</div>
                   )}
                </div>

                <div className="space-y-1">
                   <Label className="text-[10px] text-slate-500 uppercase">Próximo Envío</Label>
                   {isEditing ? (
                      <Input 
                        type="datetime-local" 
                        value={memoryForm.next_followup_at ? new Date(memoryForm.next_followup_at).toISOString().slice(0, 16) : ''} 
                        onChange={e => setMemoryForm({...memoryForm, next_followup_at: e.target.value})}
                        className="h-7 text-xs bg-slate-900 border-slate-700"
                      />
                   ) : (
                      <div className="text-[10px] text-blue-400 font-mono">
                         {currentAnalysis.next_followup_at ? new Date(currentAnalysis.next_followup_at).toLocaleString() : 'No programado'}
                      </div>
                   )}
                </div>

                <Button 
                  variant="outline" 
                  className={`w-full h-7 text-[10px] ${currentAnalysis.ai_paused ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500'}`}
                  onClick={onToggleFollowup}
                >
                   {currentAnalysis.ai_paused ? <Play className="w-3 h-3 mr-1"/> : <Pause className="w-3 h-3 mr-1"/>}
                   {currentAnalysis.ai_paused ? 'Reactivar IA' : 'Pausar IA (#STOP)'}
                </Button>
             </CardContent>
           </Card>
        </div>

        {/* 3. MEMORIA VIVA */}
        <div className="border-t border-slate-800 pt-6">
           <div className="flex items-center justify-between mb-4">
             <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
               <BrainCircuit className="w-3 h-3" /> Análisis de Perfil
             </h4>
             <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500/50 hover:text-red-500" title="Borrar memoria" onClick={handleFlushMemory} disabled={flushing}>
                  {flushing ? <Loader2 className="w-3 h-3 animate-spin"/> : <RotateCcw className="w-3 h-3" />}
                </Button>
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
           </div>

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
                   <Badge variant="outline" className={`w-full justify-center py-1 ${getMoodColor(currentAnalysis?.estado_emocional_actual)}`}>
                     {currentAnalysis?.estado_emocional_actual || 'NEUTRO'}
                   </Badge>
                 )}
               </div>

               <div className="space-y-1">
                 <Label className="text-[10px] text-slate-400 uppercase tracking-wide">Resumen Contextual</Label>
                 {isEditing ? (
                   <Textarea
                     value={memoryForm.summary}
                     onChange={e => setMemoryForm({ ...memoryForm, summary: e.target.value })}
                     className="bg-slate-950 border-slate-700 text-xs h-24 font-mono mt-1"
                   />
                 ) : (
                   <p className="text-xs text-slate-300 italic leading-relaxed bg-slate-950 p-2 rounded border border-slate-800">
                     "{currentAnalysis?.summary || 'Sin resumen...'}"
                   </p>
                 )}
               </div>
             </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
};