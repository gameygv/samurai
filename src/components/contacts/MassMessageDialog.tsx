"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, Megaphone, ShieldAlert, Save, Clock, Users, Play, Pause, AlertTriangle, BookTemplate, Image as ImageIcon, X, UploadCloud, Info } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { sendEvolutionMessage } from '@/utils/messagingService';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface MassMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetContacts: any[];
}

export const MassMessageDialog = ({ open, onOpenChange, targetContacts }: MassMessageDialogProps) => {
  const [message, setMessage] = useState('');
  const [templates, setTemplates] = useState<{id: string, name: string, text: string}[]>([]);
  const [templateName, setTemplateName] = useState('');
  
  // Novedad: Soporte Multimedia
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  const [speed, setSpeed] = useState('SAFE'); // Por defecto SEGURO
  const [sending, setSending] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [eta, setEta] = useState(0);

  const pauseRef = React.useRef(paused);
  const abortRef = React.useRef(false);

  useEffect(() => { pauseRef.current = paused; }, [paused]);
  useEffect(() => {
    if (open) {
      fetchTemplates();
      setProgress({ current: 0, total: targetContacts.length, success: 0, failed: 0 });
      setSending(false);
      setPaused(false);
      abortRef.current = false;
      calculateEta(targetContacts.length, speed);
      
      // Limpiar multimedia previa
      setMediaFile(null);
      setMediaPreview(null);
    }
  }, [open, targetContacts.length, speed]);

  const fetchTemplates = async () => {
    const { data } = await supabase.from('app_config').select('value').eq('key', 'campaign_templates').maybeSingle();
    if (data?.value) {
       try { setTemplates(JSON.parse(data.value)); } catch(e){}
    }
  };

  const saveTemplate = async () => {
    if (!templateName.trim() || !message.trim()) return toast.error("Ingresa un nombre y el mensaje.");
    const newTpl = { id: Date.now().toString(), name: templateName, text: message };
    const updated = [...templates, newTpl];
    setTemplates(updated);
    await supabase.from('app_config').upsert({ key: 'campaign_templates', value: JSON.stringify(updated), category: 'SYSTEM' }, { onConflict: 'key' });
    toast.success("Plantilla de campaña guardada.");
    setTemplateName('');
  };

  const calculateEta = (count: number, spd: string) => {
     let avgSeconds = 12; // Normal
     if (spd === 'SAFE') avgSeconds = 25;
     if (spd === 'FAST') avgSeconds = 6;
     setEta(Math.ceil((count * avgSeconds) / 60));
  };

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (file) {
        setMediaFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setMediaPreview(reader.result as string);
        reader.readAsDataURL(file);
     }
  };

  const handleStart = async () => {
     if (!message.trim() && !mediaFile) return toast.error("Añade un mensaje o una imagen.");
     if (targetContacts.length === 0) return toast.error("No hay contactos seleccionados.");

     setSending(true);
     setPaused(false);
     abortRef.current = false;
     
     let uploadedMediaData = undefined;

     // 1. Subir imagen si existe
     if (mediaFile) {
         const tid = toast.loading("Subiendo archivo multimedia a la nube...");
         const fileExt = mediaFile.name.split('.').pop();
         const fileName = `campaign_uploads/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
         const { error: uploadError } = await supabase.storage.from('media').upload(fileName, mediaFile);
         
         if (uploadError) {
             toast.error("Error subiendo la imagen de campaña.", { id: tid });
             setSending(false);
             return;
         }
         
         const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(fileName);
         let type = 'document';
         if (mediaFile.type.startsWith('image/')) type = 'image';
         else if (mediaFile.type.startsWith('video/')) type = 'video';
         
         uploadedMediaData = { url: publicUrl, type, mimetype: mediaFile.type, name: mediaFile.name };
         toast.success("Multimedia lista. Iniciando envíos...", { id: tid });
     }

     let successCount = progress.success;
     let failCount = progress.failed;
     let startIndex = progress.current;

     // 2. Ciclo de envíos
     for (let i = startIndex; i < targetContacts.length; i++) {
         if (abortRef.current) break;
         
         while (pauseRef.current) {
            await sleep(1000);
            if (abortRef.current) break;
         }
         if (abortRef.current) break;

         const contact = targetContacts[i];
         
         if (contact.telefono) {
             try {
                 const personalizedMsg = message
                    .replace(/{nombre}/g, contact.nombre?.split(' ')[0] || 'amigo')
                    .replace(/{ciudad}/g, contact.ciudad || '');
                 
                 await sendEvolutionMessage(contact.telefono, personalizedMsg, contact.lead_id, uploadedMediaData);
                 successCount++;
             } catch(e) {
                 failCount++;
             }
         } else {
             failCount++;
         }

         setProgress({ current: i + 1, total: targetContacts.length, success: successCount, failed: failCount });
         calculateEta(targetContacts.length - (i + 1), speed);
         
         // LÓGICA ANTI-BAN
         if (i < targetContacts.length - 1) {
             let minDelay = 8000, maxDelay = 15000; // NORMAL
             if (speed === 'SAFE') { minDelay = 15000; maxDelay = 35000; }
             if (speed === 'FAST') { minDelay = 3000; maxDelay = 8000; }
             
             const delay = Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;
             await sleep(delay);
         }
     }
     
     if (!abortRef.current) {
        toast.success(`Campaña finalizada: ${successCount} entregados, ${failCount} fallidos.`);
        setSending(false);
     }
  };

  const handleStop = () => {
     abortRef.current = true;
     setSending(false);
     setPaused(false);
     toast.info("Campaña abortada.");
  };

  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(val) => {
       if (sending && !val) {
          toast.error("No puedes cerrar la ventana mientras la campaña está activa. Páusala o detenla primero.");
          return;
       }
       onOpenChange(val);
    }}>
      <DialogContent className="bg-[#0f0f11] border-[#222225] text-white max-w-6xl rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] p-0 overflow-hidden flex flex-col h-[85vh]">
        <DialogHeader className="p-6 bg-[#161618] border-b border-[#222225] shrink-0">
          <DialogTitle className="flex items-center gap-3 text-indigo-400 text-xl">
             <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20"><Megaphone className="w-6 h-6" /></div>
             Campaign Manager (Anti-Ban)
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs mt-1">
             Motor de difusión inteligente. Envía mensajes personalizados y flyers simulando comportamiento humano.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
           
           {/* COLUMNA 1: AUDIENCIA Y AJUSTES */}
           <div className="w-full lg:w-80 bg-[#121214] border-r border-[#222225] flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
              <div className="p-6 space-y-6">
                 <div className="space-y-4">
                    <div className="flex justify-between items-center bg-[#0a0a0c] p-4 rounded-2xl border border-[#222225] shadow-inner">
                       <span className="text-[11px] uppercase font-bold text-slate-500 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-400"/> Audiencia Total:</span>
                       <span className="text-2xl font-mono font-bold text-white">{targetContacts.length}</span>
                    </div>

                    <div className="bg-indigo-900/10 border border-indigo-500/20 p-4 rounded-xl space-y-2">
                       <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5"/> ¿Cómo Segmentar?
                       </p>
                       <p className="text-[10px] text-slate-400 leading-relaxed">
                          Estás enviando a los contactos seleccionados en la tabla previa. Si deseas armar un segmento específico (Ej: <strong>Grupo: Mayo + Ciudad: CDMX + Etiqueta: VIP</strong>), cierra esta ventana, utiliza los filtros superiores del directorio y selecciona las casillas correspondientes.
                       </p>
                    </div>
                 </div>

                 <div className="space-y-4 pt-4 border-t border-[#222225]">
                    <div className="space-y-2">
                       <Label className="text-[10px] uppercase font-bold text-slate-500">Modo de Envío (Riesgo de Ban)</Label>
                       <Select value={speed} onValueChange={setSpeed} disabled={sending}>
                          <SelectTrigger className="bg-[#0a0a0c] border-[#222225] h-12 text-xs rounded-xl">
                             <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#161618] border-[#222225] text-white rounded-xl">
                             <SelectItem value="SAFE"><span className="text-emerald-400 font-bold">Seguro (Recomendado)</span> - Lento</SelectItem>
                             <SelectItem value="NORMAL"><span className="text-amber-400 font-bold">Normal</span> - Moderado</SelectItem>
                             <SelectItem value="FAST"><span className="text-red-400 font-bold">Agresivo (Riesgo Alto)</span> - Rápido</SelectItem>
                          </SelectContent>
                       </Select>
                       <p className="text-[9px] text-slate-500 italic mt-1 pl-1">A mayor velocidad, más riesgo de que WhatsApp bloquee tu número.</p>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono bg-[#0a0a0c] p-3 rounded-xl border border-[#222225]">
                       <Clock className="w-4 h-4 text-amber-500" />
                       Tiempo estimado: <span className="text-white font-bold">{eta} minutos</span>
                    </div>
                 </div>
              </div>
           </div>

           {/* COLUMNA 2: EDITOR PRINCIPAL */}
           <div className="flex-1 bg-[#0a0a0c] flex flex-col shrink-0 min-w-0 relative">
              {sending && (
                 <div className="absolute inset-0 bg-[#0a0a0c]/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
                    <div className="space-y-4 max-w-md w-full">
                       <h3 className="text-3xl font-bold text-white uppercase tracking-widest">{progressPercent}%</h3>
                       <p className="text-sm text-slate-400 font-mono uppercase tracking-widest mb-8">
                          {paused ? 'TRANSMISIÓN EN PAUSA' : 'ENVIANDO CAMPAÑA...'}
                       </p>

                       <div className="h-4 w-full bg-[#121214] rounded-full overflow-hidden border border-[#222225] shadow-inner">
                          <div className={cn("h-full transition-all duration-300", paused ? "bg-amber-500" : "bg-indigo-500")} style={{ width: `${progressPercent}%` }} />
                       </div>
                       
                       <div className="flex justify-between text-xs font-mono font-bold tracking-widest mt-4">
                          <span className="text-emerald-400">{progress.success} Enviados</span>
                          <span className="text-slate-500">{progress.current} / {progress.total}</span>
                          <span className="text-red-400">{progress.failed} Errores</span>
                       </div>

                       <div className="mt-8 p-4 bg-[#121214] border border-[#222225] rounded-xl flex items-start gap-3 text-left">
                          {paused ? <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" /> : <Loader2 className="w-6 h-6 text-indigo-500 animate-spin shrink-0" />}
                          <p className="text-[11px] text-slate-400 leading-relaxed uppercase tracking-widest">
                             {paused ? "Campaña en pausa. Puedes reanudarla en cualquier momento." : `Simulando escritura humana. Faltan ~${eta} min. MANTÉN ESTA PESTAÑA ABIERTA.`}
                          </p>
                       </div>
                    </div>
                 </div>
              )}

              <ScrollArea className="flex-1 p-6">
                 <div className="max-w-2xl mx-auto space-y-6">
                    
                    {/* ZONA DE MULTIMEDIA */}
                    <div className="space-y-2">
                       <Label className="text-[10px] uppercase font-bold text-slate-500 flex items-center justify-between">
                          <span>Imagen Promocional (Opcional)</span>
                       </Label>
                       
                       {mediaPreview ? (
                          <div className="relative rounded-2xl border-2 border-[#222225] overflow-hidden bg-[#121214] group">
                             <img src={mediaPreview} alt="Preview" className="w-full max-h-64 object-contain" />
                             <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Button variant="destructive" onClick={() => { setMediaFile(null); setMediaPreview(null); }} className="font-bold uppercase tracking-widest text-[10px]">
                                   <X className="w-4 h-4 mr-2" /> Quitar Imagen
                                </Button>
                             </div>
                          </div>
                       ) : (
                          <div className="border-2 border-dashed border-[#333336] rounded-2xl p-8 text-center hover:border-indigo-500/50 hover:bg-[#121214] transition-all cursor-pointer">
                             <input type="file" id="media-upload" className="hidden" accept="image/*" onChange={handleMediaChange} disabled={sending} />
                             <label htmlFor="media-upload" className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
                                <UploadCloud className="w-10 h-10 text-slate-600 mb-3" />
                                <span className="text-sm font-bold text-slate-300">Añadir Flyer o Foto</span>
                                <span className="text-[10px] text-slate-500 mt-1">Soporta JPG, PNG, WEBP</span>
                             </label>
                          </div>
                       )}
                    </div>

                    {/* ZONA DE TEXTO */}
                    <div className="space-y-2">
                       <Label className="text-[10px] uppercase font-bold text-slate-500 flex items-center justify-between">
                          <span>Cuerpo del Mensaje</span>
                          <span className="text-indigo-400 font-mono">{message.length} chars</span>
                       </Label>
                       <Textarea 
                          value={message}
                          onChange={e => setMessage(e.target.value)}
                          placeholder="Escribe tu mensaje persuasivo aquí. Puedes usar las variables de abajo para personalizarlo..."
                          className="bg-[#121214] border-[#222225] text-sm min-h-[250px] focus:border-indigo-500 rounded-2xl resize-y custom-scrollbar text-slate-200 leading-relaxed p-5"
                          disabled={sending}
                       />
                       <div className="flex flex-wrap gap-2 pt-2">
                          <Badge variant="outline" className="text-[10px] py-1.5 px-3 border-[#333336] bg-[#161618] text-slate-400 cursor-pointer hover:bg-indigo-500/20 hover:text-indigo-400 transition-colors" onClick={() => setMessage(m => m + '{nombre}')}>+ Inyectar Nombre <code>{"{nombre}"}</code></Badge>
                          <Badge variant="outline" className="text-[10px] py-1.5 px-3 border-[#333336] bg-[#161618] text-slate-400 cursor-pointer hover:bg-indigo-500/20 hover:text-indigo-400 transition-colors" onClick={() => setMessage(m => m + '{ciudad}')}>+ Inyectar Ciudad <code>{"{ciudad}"}</code></Badge>
                       </div>
                    </div>
                 </div>
              </ScrollArea>
           </div>

           {/* COLUMNA 3: PLANTILLAS (DERECHA) */}
           <div className="w-full lg:w-80 bg-[#121214] border-l border-[#222225] flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
              <div className="p-6 space-y-6 flex-1 flex flex-col">
                 <div className="space-y-3 flex-1">
                    <Label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-2"><BookTemplate className="w-4 h-4 text-amber-500"/> Plantillas Guardadas</Label>
                    <ScrollArea className="h-full max-h-[400px] bg-[#0a0a0c] border border-[#222225] rounded-2xl p-2 shadow-inner">
                       {templates.length === 0 ? (
                          <p className="text-center text-[10px] text-slate-600 mt-10 uppercase tracking-widest font-bold">Sin plantillas</p>
                       ) : templates.map(t => (
                          <button key={t.id} onClick={() => setMessage(t.text)} className="w-full text-left p-3 hover:bg-[#161618] rounded-xl text-xs text-slate-300 mb-1 border border-transparent hover:border-[#333336] transition-colors group">
                             <div className="font-bold text-indigo-400 mb-1 group-hover:text-indigo-300">{t.name}</div>
                             <div className="text-[10px] opacity-60 line-clamp-2 leading-relaxed">{t.text}</div>
                          </button>
                       ))}
                    </ScrollArea>
                 </div>

                 {!sending && (
                    <div className="pt-4 border-t border-[#222225] space-y-3">
                       <Label className="text-[10px] uppercase font-bold text-slate-500">Guardar como Plantilla</Label>
                       <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Nombre de la campaña..." className="h-11 text-xs bg-[#161618] border-[#222225] rounded-xl focus-visible:ring-indigo-500" />
                       <Button onClick={saveTemplate} className="w-full h-11 bg-[#161618] hover:bg-[#222225] border border-[#333336] text-white font-bold text-[10px] uppercase tracking-widest rounded-xl"><Save className="w-4 h-4 mr-2 text-indigo-400"/> Guardar Plantilla</Button>
                    </div>
                 )}
              </div>
           </div>
        </div>

        {/* FOOTER GENERAL */}
        <DialogFooter className="p-6 bg-[#161618] border-t border-[#222225] flex justify-between shrink-0">
           {!sending ? (
              <>
                 <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl h-12 px-6 text-xs uppercase font-bold tracking-widest text-slate-400 hover:text-white hover:bg-[#222225]">Cancelar</Button>
                 <Button onClick={handleStart} disabled={(!message.trim() && !mediaFile) || targetContacts.length === 0} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-10 h-12 rounded-xl shadow-lg shadow-indigo-900/20 uppercase tracking-widest text-[11px] transition-all active:scale-95">
                    <Play className="w-4 h-4 mr-2" /> Iniciar Transmisión
                 </Button>
              </>
           ) : (
              <div className="w-full flex gap-3 justify-end">
                 <Button variant="destructive" onClick={handleStop} className="h-12 rounded-xl font-bold uppercase tracking-widest text-[11px] px-8 bg-red-950/80 text-red-400 hover:bg-red-600 hover:text-white border border-red-900/50">
                    <X className="w-4 h-4 mr-2" /> Abortar Misión
                 </Button>
                 {paused ? (
                    <Button onClick={() => setPaused(false)} className="bg-emerald-600 hover:bg-emerald-500 h-12 rounded-xl font-bold uppercase tracking-widest text-[11px] px-10 text-slate-950 shadow-lg">
                       <Play className="w-4 h-4 mr-2" /> Reanudar
                    </Button>
                 ) : (
                    <Button onClick={() => setPaused(true)} className="bg-amber-600 hover:bg-amber-500 text-slate-950 h-12 rounded-xl font-bold uppercase tracking-widest text-[11px] px-10 shadow-lg">
                       <Pause className="w-4 h-4 mr-2" /> Pausar Envío
                    </Button>
                 )}
              </div>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};