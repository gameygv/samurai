import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BrainCircuit, Edit2, X, Save, Loader2, Bot, TrendingUp, AlertCircle, RotateCcw, Clock, Play, Pause, ShieldAlert, Zap, Calendar, Trash2, RefreshCcw, MapPin, User, FileText } from 'lucide-react';
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
    if (!confirm("¿Deseas borrar la memoria de este lead?")) return;
    setFlushing(true);
    try {
      await supabase.from('leads').update({
        summary: null,
        estado_emocional_actual: 'NEUTRO',
        buying_intent: 'BAJO',
        perfil_psicologico: null,
        ciudad: null
      }).eq('id', currentAnalysis.id);
      toast.success('Memoria reseteada.');
      window.location.reload();
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
           <Textarea 
             value={correctionText}
             onChange={e => setCorrectionText(e.target.value)}
             placeholder="Ej: No ofrezcas descuento todavía..."
             className="bg-slate-950 border-slate-800 text-xs min-h-[60px]"
           />
           <Button onClick={handleSaveCorrection} disabled={isReporting || !correctionText.trim()} className="w-full h-8 text-[10px] bg-yellow-600 font-bold">
             {isReporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 mr-2" />} Guardar Regla
           </Button>
        </div>

        {/* 2. IDENTIDAD & UBICACIÓN */}
        <div className="border-t border-slate-800 pt-6 space-y-4">
           <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                  <User className="w-3 h-3" /> Perfil de Prospecto
              </h4>
              {!isEditing && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditing(true)}><Edit2 className="w-3 h-3" /></Button>}
           </div>
           <div className="space-y-3">
              <div className="space-y-1">
                 <Label className="text-[9px] text-slate-500 uppercase">Intención de Compra</Label>
                 {isEditing ? (
                    <Select value={memoryForm.buying_intent} onValueChange={v => setMemoryForm({...memoryForm, buying_intent: v})}>
                       <SelectTrigger className="h-7 text-xs bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                       <SelectContent className="bg-slate-900 text-white">
                          <SelectItem value="BAJO">Bajo</SelectItem>
                          <SelectItem value="MEDIO">Medio</SelectItem>
                          <SelectItem value="ALTO">Alto 🔥</SelectItem>
                       </SelectContent>
                    </Select>
                 ) : (
                    <Badge className={currentAnalysis.buying_intent === 'ALTO' ? 'bg-green-600' : 'bg-slate-800'}>{currentAnalysis.buying_intent || 'BAJO'}</Badge>
                 )}
              </div>
              <div className="space-y-1">
                 <Label className="text-[9px] text-slate-500 uppercase">Ubicación</Label>
                 {isEditing ? (
                    <Input value={memoryForm.ciudad || ''} onChange={e => setMemoryForm({...memoryForm, ciudad: e.target.value})} className="h-7 text-xs bg-slate-950 border-slate-800" />
                 ) : (
                    <div className="text-xs text-slate-300 flex items-center gap-1"><MapPin className="w-3 h-3 text-red-500" /> {currentAnalysis.ciudad || 'Pendiente'}</div>
                 )}
              </div>
           </div>
        </div>

        {/* 3. PERFIL PSICOGRÁFICO */}
        <div className="border-t border-slate-800 pt-6 space-y-3">
           <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
               <BrainCircuit className="w-3 h-3" /> Perfil Psicográfico
           </h4>
           {isEditing ? (
              <Textarea 
                value={memoryForm.perfil_psicologico || ''}
                onChange={e => setMemoryForm({...memoryForm, perfil_psicologico: e.target.value})}
                className="bg-slate-950 border-slate-800 text-[10px] min-h-[100px]"
                placeholder="Notas sobre el comportamiento del cliente..."
              />
           ) : (
              <div className="bg-slate-950 p-3 rounded border border-slate-800 text-[10px] text-slate-400 italic leading-relaxed">
                 {currentAnalysis.perfil_psicologico || "Samurai aún no ha definido un perfil psicográfico para este lead."}
              </div>
           )}
        </div>

        {/* 4. RESUMEN VIVO */}
        <div className="border-t border-slate-800 pt-6 space-y-3">
           <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
               <FileText className="w-3 h-3" /> Resumen de Charla
           </h4>
           {isEditing ? (
              <Textarea 
                value={memoryForm.summary || ''}
                onChange={e => setMemoryForm({...memoryForm, summary: e.target.value})}
                className="bg-slate-950 border-slate-800 text-[10px] h-20"
              />
           ) : (
              <p className="text-[11px] text-slate-300 leading-relaxed">"{currentAnalysis.summary || 'Sin resumen...'}"</p>
           )}
        </div>

        {/* 5. CONTROLES DE IA */}
        <div className="border-t border-slate-800 pt-6">
           <Button 
             variant="outline" 
             className={`w-full h-8 text-[10px] ${currentAnalysis.ai_paused ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500'}`}
             onClick={onToggleFollowup}
           >
              {currentAnalysis.ai_paused ? <Play className="w-3 h-3 mr-1"/> : <Pause className="w-3 h-3 mr-1"/>}
              {currentAnalysis.ai_paused ? 'Reactivar Samurai (#START)' : 'Pausar Samurai (#STOP)'}
           </Button>
           <Button variant="ghost" className="w-full mt-2 text-[9px] text-slate-600 hover:text-red-500" onClick={handleFlushMemory} disabled={flushing}>
              <RotateCcw className="w-3 h-3 mr-1" /> Resetear Memoria
           </Button>
        </div>

        {isEditing && (
           <Button onClick={onSave} disabled={saving} className="w-full bg-indigo-600 h-9 font-bold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar Cambios
           </Button>
        )}
      </div>
    </div>
  );
};