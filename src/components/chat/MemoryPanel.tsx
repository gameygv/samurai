import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { BrainCircuit, Edit2, Save, Loader2, ShieldAlert, Zap, Fingerprint, Sparkles, Heart, ShieldX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  onAnalysisComplete?: () => void;
}

export const MemoryPanel = ({
  currentAnalysis, isEditing, setIsEditing,
  memoryForm, setMemoryForm, onSave, saving,
  onToggleFollowup, onAnalysisComplete
}: MemoryPanelProps) => {

  const [correctionText, setCorrectionText] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const hasName = currentAnalysis.nombre && !currentAnalysis.nombre.includes('Nuevo');
  const hasCity = currentAnalysis.ciudad && currentAnalysis.ciudad.length > 2;
  const hasEmail = currentAnalysis.email && currentAnalysis.email.includes('@');
  const healthPercent = (Number(!!hasName) + Number(!!hasCity) + Number(!!hasEmail)) * 33.3;

  const handleRunAnalysis = async () => {
     setAnalyzing(true);
     const tid = toast.loading("Sam escaneando intenciones...");
     try {
        const { data, error } = await supabase.functions.invoke('analyze-leads', {
           body: { lead_id: currentAnalysis.id }
        });
        if (error) throw new Error(error.message);
        toast.success(`¡Perfil Enriquecido!`, { id: tid });
        if (onAnalysisComplete) onAnalysisComplete();
     } catch (err: any) {
        toast.error("Error: " + err.message, { id: tid });
     } finally {
        setAnalyzing(false);
     }
  };

  const handleSaveCorrection = async () => {
    if (!correctionText.trim()) return;
    setIsReporting(true);
    try {
      await supabase.from('errores_ia').insert({
        cliente_id: currentAnalysis.id,
        mensaje_cliente: 'Corrección manual',
        respuesta_ia: 'N/A',
        correccion_sugerida: correctionText,
        categoria: 'CONDUCTA'
      });
      toast.success('Lección guardada en Bitácora');
      setCorrectionText('');
    } finally {
      setIsReporting(false);
    }
  };

  return (
    <div className="w-[340px] min-w-[340px] flex-shrink-0 bg-slate-900/90 flex flex-col overflow-y-auto border-l border-slate-800">
      <div className="p-5 space-y-6">

        {/* CAPI HEALTH */}
        <div className="space-y-3">
           <div className="flex justify-between items-end">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Salud de Datos (CAPI)</h4>
              <span className="text-[10px] font-mono text-amber-500 font-bold">{Math.round(healthPercent)}%</span>
           </div>
           <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
              <div className={cn("h-full transition-all duration-1000", healthPercent > 60 ? 'bg-emerald-500' : 'bg-amber-500')} style={{ width: `${healthPercent}%` }} />
           </div>
        </div>

        {/* PSYCHOGRAPHIC RADAR */}
        <div className="space-y-4 border-t border-slate-800/60 pt-6">
           <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" /> Perfil Táctico
              </h4>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-amber-500" onClick={handleRunAnalysis} disabled={analyzing}>
                 {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              </Button>
           </div>
           
           <div className="space-y-3">
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl shadow-inner">
                 <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1"><Heart className="w-3 h-3" /> Motivación</p>
                 <p className="text-[10px] text-slate-300 italic">{currentAnalysis.perfil_psicologico?.split('OBJECIÓN:')[0].replace('MOTIVACIÓN:', '').trim() || 'Desconocida'}</p>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl shadow-inner">
                 <p className="text-[9px] text-red-400 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1"><ShieldX className="w-3 h-3" /> Objeción</p>
                 <p className="text-[10px] text-slate-300 italic">{currentAnalysis.perfil_psicologico?.split('OBJECIÓN:')[1]?.split('PERFIL:')[0].trim() || 'Ninguna detectada'}</p>
              </div>
           </div>
        </div>

        {/* CORE DATA */}
        <div className="border-t border-slate-800/60 pt-6 space-y-4">
           <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Datos de Registro</h4>
              {!isEditing && <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-white" onClick={() => setIsEditing(true)}><Edit2 className="w-3 h-3" /></Button>}
           </div>
           
           <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner">
              <div className="space-y-1">
                 <Label className="text-[9px] text-slate-500 uppercase tracking-widest">Nombre</Label>
                 {isEditing ? <Input value={memoryForm.nombre} onChange={e => setMemoryForm({...memoryForm, nombre: e.target.value})} className="h-8 text-xs bg-slate-900 border-slate-700" /> : 
                 <div className="text-xs text-slate-100 font-bold">{currentAnalysis.nombre || 'Desconocido'}</div>}
              </div>
              <div className="space-y-1">
                 <Label className="text-[9px] text-slate-500 uppercase tracking-widest">Email</Label>
                 {isEditing ? <Input value={memoryForm.email} onChange={e => setMemoryForm({...memoryForm, email: e.target.value})} className="h-8 text-xs bg-slate-900 border-slate-700" /> : 
                 <div className="text-xs truncate font-mono text-emerald-400">{currentAnalysis.email || 'Falta Email'}</div>}
              </div>
              <div className="space-y-1">
                 <Label className="text-[9px] text-slate-500 uppercase tracking-widest">Ciudad</Label>
                 {isEditing ? <Input value={memoryForm.ciudad} onChange={e => setMemoryForm({...memoryForm, ciudad: e.target.value})} className="h-8 text-xs bg-slate-900 border-slate-700" /> : 
                 <div className="text-xs text-slate-300">{currentAnalysis.ciudad || 'Pendiente'}</div>}
              </div>
           </div>
           {isEditing && <Button onClick={onSave} disabled={saving} className="w-full bg-indigo-900 hover:bg-indigo-800 text-amber-500 h-10 text-xs font-bold shadow-lg rounded-xl"><Save className="w-3.5 h-3.5 mr-2" /> Guardar Cambios</Button>}
        </div>

        {/* BITÁCORA #CIA QUICK */}
        <div className="space-y-3 border-t border-slate-800/60 pt-6">
           <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
              <ShieldAlert className="w-3 h-3" /> #CorregirIA
           </h4>
           <Textarea value={correctionText} onChange={e => setCorrectionText(e.target.value)} placeholder="Instrucción de conducta..." className="bg-slate-950 border-slate-800 text-xs min-h-[60px] focus:border-amber-500 rounded-xl" />
           <Button onClick={handleSaveCorrection} disabled={isReporting || !correctionText.trim()} className="w-full h-9 text-[10px] border-amber-500/50 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 font-bold uppercase tracking-widest rounded-xl">
             {isReporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 mr-2" />} Inyectar Lección
           </Button>
        </div>

        <div className="border-t border-slate-800/60 pt-6">
           <Button variant="outline" className={`w-full h-11 text-xs font-bold uppercase tracking-widest rounded-xl shadow-lg transition-all ${currentAnalysis.ai_paused ? 'border-emerald-500/50 text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20' : 'border-red-500/50 text-red-500 bg-red-500/10 hover:bg-red-500/20'}`} onClick={onToggleFollowup}>
              {currentAnalysis.ai_paused ? <Zap className="w-4 h-4 mr-2"/> : <ShieldAlert className="w-4 h-4 mr-2"/>}
              {currentAnalysis.ai_paused ? 'ACTIVAR SAMURAI' : 'PAUSAR SAMURAI'}
           </Button>
        </div>
      </div>
    </div>
  );
};