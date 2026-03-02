import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { BrainCircuit, Edit2, Save, Loader2, ShieldAlert, Zap, MapPin, User, Mail, Fingerprint, Send, Sparkles, RefreshCw, RotateCcw, Play, Pause } from 'lucide-react';
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
  onReset, onToggleFollowup, onAnalysisComplete
}: MemoryPanelProps) => {

  const [correctionText, setCorrectionText] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [syncingCapi, setSyncingCapi] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const handleRunAnalysis = async () => {
     setAnalyzing(true);
     const tid = toast.loading("GPT-4o escaneando chat...");
     try {
        const { data, error } = await supabase.functions.invoke('analyze-leads', {
           body: { lead_id: currentAnalysis.id }
        });
        
        if (error) throw new Error(error.message);
        
        if (data && data.success) {
           const lead = data.lead;
           
           // ACTUALIZACIÓN FORZOSA DE LA UI
           setMemoryForm({
              nombre: lead.nombre || '',
              email: lead.email || '',
              ciudad: lead.ciudad || '',
              summary: lead.summary || '',
              perfil_psicologico: lead.perfil_psicologico || '',
              mood: lead.estado_emocional_actual || 'NEUTRO',
              buying_intent: lead.buying_intent || 'BAJO',
              followup_stage: lead.followup_stage || 0,
              next_followup_at: lead.next_followup_at || null
           });

           const found = [];
           if (data.extracted.email) found.push("Email");
           if (data.extracted.ciudad) found.push("Ciudad");

           if (found.length > 0) {
              toast.success(`¡Capturado: ${found.join(', ')}!`, { id: tid });
           } else {
              toast.info("Análisis completo. No hay datos nuevos.", { id: tid });
           }
           
           if (onAnalysisComplete) onAnalysisComplete();
        } else {
           throw new Error(data?.error || "La función devolvió un error desconocido.");
        }
     } catch (err: any) {
        console.error("Analysis Error:", err);
        toast.error("Error: " + err.message, { id: tid });
     } finally {
        setAnalyzing(false);
     }
  };

  const handleSaveCorrection = async () => {
    if (!correctionText.trim()) return;
    setIsReporting(true);
    try {
      const { error } = await supabase.from('errores_ia').insert({
        cliente_id: currentAnalysis.id,
        mensaje_cliente: 'Corrección manual',
        respuesta_ia: 'N/A',
        correccion_sugerida: correctionText,
        categoria: 'CONDUCTA'
      });
      if (error) throw error;
      toast.success('Regla enviada a bitácora');
      setCorrectionText('');
    } catch (err: any) {
      toast.error('Error al guardar');
    } finally {
      setIsReporting(false);
    }
  };

  const handleSyncToCapi = async () => {
     if (!currentAnalysis.email || !currentAnalysis.nombre) {
        toast.error("Falta Email/Nombre para Meta CAPI.");
        return;
     }
     setSyncingCapi(true);
     try {
        const { data: configData } = await supabase.from('app_config').select('*').in('key', ['meta_pixel_id', 'meta_access_token']);
        const config: any = {};
        configData?.forEach(c => config[c.key.replace('meta_', '')] = c.value);

        const { error } = await supabase.functions.invoke('meta-capi-sender', {
           body: {
              eventData: {
                 event_name: 'Lead',
                 lead_id: currentAnalysis.id,
                 user_data: { ph: currentAnalysis.telefono, em: currentAnalysis.email, fn: currentAnalysis.nombre, ct: currentAnalysis.ciudad }
              },
              config
           }
        });
        if (error) throw error;
        await supabase.from('leads').update({ capi_lead_event_sent_at: new Date().toISOString() }).eq('id', currentAnalysis.id);
        toast.success("Enviado a Meta CAPI.");
        if (onAnalysisComplete) onAnalysisComplete();
     } catch (err: any) {
        toast.error("Error CAPI: " + err.message);
     } finally {
        setSyncingCapi(false);
     }
  };

  return (
    <div className="w-[320px] bg-slate-900/30 flex flex-col overflow-y-auto border-l border-slate-800">
      <div className="p-4 space-y-6">

        <div className="space-y-3">
           <h4 className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-2">
              <ShieldAlert className="w-3 h-3" /> #CorregirIA
           </h4>
           <Textarea value={correctionText} onChange={e => setCorrectionText(e.target.value)} placeholder="Ej: No ofrezcas descuento todavía..." className="bg-slate-950 border-slate-800 text-xs min-h-[60px]" />
           <Button onClick={handleSaveCorrection} disabled={isReporting || !correctionText.trim()} className="w-full h-8 text-[10px] bg-yellow-600 font-bold">
             {isReporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 mr-2" />} Guardar Regla
           </Button>
        </div>

        <div className="border-t border-slate-800 pt-6 space-y-4">
           <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                  <Fingerprint className="w-3 h-3" /> Datos Meta CAPI
              </h4>
              <div className="flex gap-1">
                 <Button variant="ghost" size="icon" className="h-6 w-6 text-indigo-400 hover:bg-indigo-500/10" onClick={handleRunAnalysis} disabled={analyzing} title="Analizar Chat">
                    {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                 </Button>
                 {!isEditing && <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white" onClick={() => setIsEditing(true)}><Edit2 className="w-3 h-3" /></Button>}
              </div>
           </div>
           
           <div className="space-y-3 bg-slate-950/50 p-3 rounded-lg border border-slate-800">
              <div className="space-y-1">
                 <Label className="text-[9px] text-slate-500 uppercase">Nombre</Label>
                 {isEditing ? <Input value={memoryForm.nombre} onChange={e => setMemoryForm({...memoryForm, nombre: e.target.value})} className="h-7 text-xs bg-slate-900 border-slate-700" /> : 
                 <div className="text-xs text-white font-bold truncate">{currentAnalysis.nombre || 'Desconocido'}</div>}
              </div>
              <div className="space-y-1">
                 <Label className="text-[9px] text-slate-500 uppercase">Email</Label>
                 {isEditing ? <Input value={memoryForm.email} onChange={e => setMemoryForm({...memoryForm, email: e.target.value})} className="h-7 text-xs bg-slate-900 border-slate-700" /> : 
                 <div className={`text-xs truncate ${currentAnalysis.email ? 'text-emerald-400' : 'text-red-400 italic'}`}>{currentAnalysis.email || 'Falta Email'}</div>}
              </div>
              <div className="space-y-1">
                 <Label className="text-[9px] text-slate-500 uppercase">Ciudad</Label>
                 {isEditing ? <Input value={memoryForm.ciudad} onChange={e => setMemoryForm({...memoryForm, ciudad: e.target.value})} className="h-7 text-xs bg-slate-900 border-slate-700" /> : 
                 <div className="text-xs text-slate-300">{currentAnalysis.ciudad || 'Pendiente'}</div>}
              </div>
           </div>

           {!isEditing && currentAnalysis.email && currentAnalysis.nombre && (
              <Button onClick={handleSyncToCapi} disabled={syncingCapi || !!currentAnalysis.capi_lead_event_sent_at} className={cn("w-full h-8 text-[9px] font-bold uppercase", currentAnalysis.capi_lead_event_sent_at ? "bg-emerald-600/20 text-emerald-500" : "bg-indigo-600")}>
                 {syncingCapi ? <Loader2 className="w-3 h-3 animate-spin mr-2"/> : <Send className="w-3 h-3 mr-2"/>} {currentAnalysis.capi_lead_event_sent_at ? '✓ Enviado CAPI' : 'Sincronizar CAPI'}
              </Button>
           )}
        </div>

        <div className="border-t border-slate-800 pt-6 space-y-3">
           <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
               <BrainCircuit className="w-3 h-3" /> Perfil Psicográfico
           </h4>
           {isEditing ? <Textarea value={memoryForm.perfil_psicologico} onChange={e => setMemoryForm({...memoryForm, perfil_psicologico: e.target.value})} className="bg-slate-950 border-slate-800 text-[10px] min-h-[80px]" /> : 
           <div className="bg-slate-950 p-3 rounded border border-slate-800 text-[10px] text-slate-400 italic leading-relaxed">{currentAnalysis.perfil_psicologico || "Sin perfil."}</div>}
        </div>

        <div className="border-t border-slate-800 pt-6">
           <Button variant="outline" className={`w-full h-8 text-[10px] ${currentAnalysis.ai_paused ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500'}`} onClick={onToggleFollowup}>
              {currentAnalysis.ai_paused ? <Play className="w-3 h-3 mr-1"/> : <Pause className="w-3 h-3 mr-1"/>}
              {currentAnalysis.ai_paused ? 'Reactivar Samurai' : 'Pausar Samurai'}
           </Button>
        </div>

        {isEditing && (
           <Button onClick={onSave} disabled={saving} className="w-full bg-indigo-600 h-9 font-bold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar Datos
           </Button>
        )}
      </div>
    </div>
  );
};