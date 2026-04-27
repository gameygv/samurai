import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Send, Megaphone, ShieldAlert, Save, Clock, Users, Play, Pause, AlertTriangle, BookTemplate, Image as ImageIcon, X, UploadCloud, Info, Eye, Lock, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { sendEvolutionMessage } from '@/utils/messagingService';
import { logActivity } from '@/utils/logger';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface MassMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetContacts: any[];
  onScheduled?: () => void;
}

export const MassMessageDialog = ({ open, onOpenChange, targetContacts, onScheduled }: MassMessageDialogProps) => {
  const { isDev } = useAuth();
  const [message, setMessage] = useState('');
  const [templates, setTemplates] = useState<{id: string, name: string, text: string}[]>([]);
  const [templateName, setTemplateName] = useState('');
  
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  const [speed, setSpeed] = useState('SAFE');
  const [sending, setSending] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [eta, setEta] = useState(0);

  // Scheduling State
  const [sendMode, setSendMode] = useState<'NOW' | 'SCHEDULE'>('NOW');
  const [campaignTitle, setCampaignTitle] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');

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
      setSpeed('SAFE');
      calculateEta(targetContacts.length, 'SAFE');
      
      setMediaFile(null);
      setMediaPreview(null);
      setCampaignTitle('');
      
      // Auto-set schedule date to 10 mins from now
      const d = new Date();
      d.setMinutes(d.getMinutes() + 10);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      setScheduledDate(d.toISOString().slice(0, 16));
    }
  }, [open, targetContacts.length]);

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
     let avgSeconds = 15; // Scheduled avg
     if (sendMode === 'NOW') {
         if (spd === 'SAFE') avgSeconds = 25;
         if (spd === 'FAST') avgSeconds = 6;
     }
     setEta(Math.ceil((count * avgSeconds) / 60));
  };

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;
     if (file.size > 16 * 1024 * 1024) {
        toast.error('Archivo muy grande. Máximo 16MB para WhatsApp.');
        return;
     }
     setMediaFile(file);
     if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setMediaPreview(reader.result as string);
        reader.readAsDataURL(file);
     } else {
        setMediaPreview(null); // no image preview for video/audio
     }
  };

  const uploadMediaAsset = async () => {
      if (!mediaFile) return undefined;
      const fileExt = mediaFile.name.split('.').pop();
      const fileName = `campaign_uploads/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('media').upload(fileName, mediaFile);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(fileName);
      let type = 'document';
      if (mediaFile.type.startsWith('image/')) type = 'image';
      else if (mediaFile.type.startsWith('video/')) type = 'video';
      else if (mediaFile.type.startsWith('audio/')) type = 'audio';
      
      return { url: publicUrl, type, mimetype: mediaFile.type, name: mediaFile.name };
  };

  const handleScheduleCampaign = async () => {
      if (!campaignTitle.trim()) return toast.error("Asigna un nombre a la campaña.");
      if (!scheduledDate) return toast.error("Selecciona la fecha y hora de inicio.");
      if (!message.trim() && !mediaFile) return toast.error("Añade un mensaje o imagen.");

      setSending(true);
      const tid = toast.loading("Programando campaña en la nube...");

      try {
          let uploadedMediaData = undefined;
          if (mediaFile) {
              uploadedMediaData = await uploadMediaAsset();
          }

          const newCampaign = {
              id: `camp-${Date.now()}`,
              name: campaignTitle,
              message,
              mediaData: uploadedMediaData,
              scheduledAt: new Date(scheduledDate).toISOString(),
              status: 'pending', // pending, processing, completed
              contacts: targetContacts.map(c => ({
                  id: c.id, lead_id: c.lead_id, telefono: c.telefono, nombre: c.nombre, ciudad: c.ciudad, status: 'pending'
              }))
          };

          const { data: existingData } = await supabase.from('app_config').select('value').eq('key', 'scheduled_campaigns').maybeSingle();
          let existingCampaigns = [];
          if (existingData?.value) {
              try { existingCampaigns = JSON.parse(existingData.value); } catch(e){}
          }

          existingCampaigns.push(newCampaign);

          const { error } = await supabase.from('app_config').upsert({
              key: 'scheduled_campaigns', value: JSON.stringify(existingCampaigns), category: 'SYSTEM'
          }, { onConflict: 'key' });

          if (error) throw error;

          await logActivity({ action: 'CREATE', resource: 'SYSTEM', description: `Campaña programada: ${campaignTitle} (${targetContacts.length} leads)`, status: 'OK' });

          toast.success("Campaña programada exitosamente. Puedes cerrar esta ventana.", { id: tid });
          setSending(false);
          if (onScheduled) onScheduled();
          onOpenChange(false);
      } catch (err: any) {
          toast.error("Error al programar: " + err.message, { id: tid });
          setSending(false);
      }
  };

  const handleStartNow = async () => {
     if (!message.trim() && !mediaFile) return toast.error("Añade un mensaje o una imagen.");
     if (targetContacts.length === 0) return toast.error("No hay contactos seleccionados.");

     setSending(true);
     setPaused(false);
     abortRef.current = false;
     
     let uploadedMediaData = undefined;

     if (mediaFile) {
         const tid = toast.loading("Subiendo archivo multimedia a la nube...");
         try {
             uploadedMediaData = await uploadMediaAsset();
             toast.success("Multimedia lista. Iniciando envíos...", { id: tid });
         } catch (e) {
             toast.error("Error subiendo la imagen.", { id: tid });
             setSending(false);
             return;
         }
     }

     let successCount = progress.success;
     let failCount = progress.failed;
     let startIndex = progress.current;

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
                 
                 if (contact.lead_id) {
                     await supabase.from('conversaciones').insert({ 
                        lead_id: contact.lead_id, mensaje: personalizedMsg || (uploadedMediaData ? `[ARCHIVO ENVIADO]` : ''), 
                        emisor: 'HUMANO', platform: 'PANEL'
                     });
                 }

                 successCount++;
             } catch(e) { failCount++; }
         } else { failCount++; }

         setProgress({ current: i + 1, total: targetContacts.length, success: successCount, failed: failCount });
         calculateEta(targetContacts.length - (i + 1), speed);
         
         if (i < targetContacts.length - 1) {
             let minDelay = 8000, maxDelay = 15000;
             if (speed === 'SAFE') { minDelay = 15000; maxDelay = 35000; }
             if (speed === 'FAST') { minDelay = 3000; maxDelay = 8000; }
             const delay = Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;
             await sleep(delay);
         }
     }
     
     if (!abortRef.current) {
        toast.success(`Campaña finalizada: ${successCount} entregados, ${failCount} fallidos.`);
        await logActivity({ action: 'UPDATE', resource: 'LEADS', description: `📣 Campaña Manual enviada a ${targetContacts.length} contactos.`, status: failCount > 0 ? 'ERROR' : 'OK' });
        setSending(false);
     }
  };

  const handleStop = () => {
     abortRef.current = true;
     setSending(false);
     setPaused(false);
     toast.info("Campaña abortada.");
  };

  const handleSpeedChange = (val: string) => { setSpeed(val); calculateEta(targetContacts.length, val); };

  const previewContact = targetContacts.length > 0 ? targetContacts[0] : { nombre: 'Juan Pérez', ciudad: 'Monterrey' };
  const previewMessage = message.replace(/{nombre}/g, previewContact.nombre?.split(' ')[0] || 'amigo').replace(/{ciudad}/g, previewContact.ciudad || 'tu ciudad');
  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(val) => {
       if (sending && sendMode === 'NOW' && !val) {
          toast.error("No puedes cerrar la ventana mientras la campaña está activa. Páusala o detenla primero.");
          return;
       }
       onOpenChange(val);
    }}>
      <DialogContent className="bg-[#0f0f11] border-[#222225] text-white max-w-6xl rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] p-0 overflow-hidden flex flex-col h-[85vh]">
        <DialogHeader className="p-6 bg-[#161618] border-b border-[#222225] shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div>
                <DialogTitle className="flex items-center gap-3 text-indigo-400 text-xl">
                  <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20"><Megaphone className="w-6 h-6" /></div>
                  Campaign Manager (Anti-Ban)
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-xs mt-1">
                  Motor de difusión inteligente. Envía mensajes de forma segura simulando el comportamiento humano.
                </DialogDescription>
             </div>
             
             {!sending && (
                <Tabs value={sendMode} onValueChange={(v: any) => { setSendMode(v); calculateEta(targetContacts.length, speed); }} className="w-[280px]">
                  <TabsList className="grid grid-cols-2 bg-[#0a0a0c] border border-[#222225] h-11 p-1 rounded-xl">
                    <TabsTrigger value="NOW" className="rounded-lg text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white">En Vivo</TabsTrigger>
                    <TabsTrigger value="SCHEDULE" className="rounded-lg text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-amber-600 data-[state=active]:text-slate-900"><CalendarClock className="w-3.5 h-3.5 mr-1"/> Programar</TabsTrigger>
                  </TabsList>
                </Tabs>
             )}
          </div>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
           
           {/* COLUMNA 1: AUDIENCIA Y AJUSTES */}
           <div className="w-full lg:w-[340px] bg-[#121214] border-r border-[#222225] flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
              <div className="p-6 space-y-6">
                 <div className="space-y-4">
                    <div className="flex justify-between items-center bg-[#0a0a0c] p-4 rounded-2xl border border-[#222225] shadow-inner">
                       <span className="text-[11px] uppercase font-bold text-slate-500 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-400"/> Audiencia Total:</span>
                       <span className="text-2xl font-mono font-bold text-white">{targetContacts.length}</span>
                    </div>

                    {sendMode === 'SCHEDULE' && (
                       <div className="bg-amber-900/10 border border-amber-500/20 p-4 rounded-xl space-y-4 animate-in slide-in-from-left-4">
                          <div className="space-y-2">
                             <Label className="text-[10px] text-amber-500 uppercase font-bold tracking-widest">Nombre de la Campaña *</Label>
                             <Input value={campaignTitle} onChange={e => setCampaignTitle(e.target.value)} placeholder="Promo Primavera..." className="bg-[#0a0a0c] border-[#222225] h-10 text-xs focus-visible:ring-amber-500" />
                          </div>
                          <div className="space-y-2">
                             <Label className="text-[10px] text-amber-500 uppercase font-bold tracking-widest">Fecha y Hora de Inicio *</Label>
                             <Input type="datetime-local" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="bg-[#0a0a0c] border-[#222225] h-10 text-xs focus-visible:ring-amber-500" />
                          </div>
                       </div>
                    )}

                    {sendMode === 'NOW' && (
                       <div className="space-y-2 pt-2">
                          <Label className="text-[10px] uppercase font-bold text-slate-500">Modo de Envío (Riesgo Ban)</Label>
                          <Select value={speed} onValueChange={handleSpeedChange} disabled={sending || !isDev}>
                             <SelectTrigger className={cn("bg-[#0a0a0c] border-[#222225] h-12 text-xs rounded-xl", !isDev && "opacity-80")}>
                                <SelectValue />
                             </SelectTrigger>
                             <SelectContent className="bg-[#161618] border-[#222225] text-white rounded-xl">
                                <SelectItem value="SAFE"><span className="text-emerald-400 font-bold">Seguro (Recomendado)</span> - Lento</SelectItem>
                                {isDev && (
                                   <>
                                      <SelectItem value="NORMAL"><span className="text-amber-400 font-bold">Normal</span> - Moderado</SelectItem>
                                      <SelectItem value="FAST"><span className="text-red-400 font-bold">Agresivo (Riesgo Alto)</span> - Rápido</SelectItem>
                                   </>
                                )}
                             </SelectContent>
                          </Select>
                          {!isDev && <p className="text-[9px] text-amber-500 italic mt-1 pl-1 flex items-center gap-1"><Lock className="w-3 h-3"/> Solo Developers pueden cambiar la velocidad.</p>}
                       </div>
                    )}
                 </div>

                 <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono bg-[#0a0a0c] p-3 rounded-xl border border-[#222225]">
                    <Clock className={cn("w-4 h-4", sendMode === 'SCHEDULE' ? 'text-indigo-400' : 'text-amber-500')} />
                    Tiempo estimado: <span className="text-white font-bold">~{eta} minutos</span>
                 </div>
              </div>
           </div>

           {/* COLUMNA 2: EDITOR PRINCIPAL */}
           <div className="flex-1 bg-[#0a0a0c] flex flex-col shrink-0 min-w-0 relative">
              {sending && sendMode === 'NOW' && (
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
                 <div className="max-w-2xl mx-auto space-y-6 pb-6">
                    
                    {/* ZONA DE MULTIMEDIA */}
                    <div className="space-y-2">
                       <Label className="text-[10px] uppercase font-bold text-slate-500 flex items-center justify-between">
                          <span>Multimedia (Opcional)</span>
                       </Label>
                       
                       {mediaFile ? (
                          <div className="relative rounded-2xl border-2 border-[#222225] overflow-hidden bg-[#121214] group">
                             {mediaPreview ? (
                                <img src={mediaPreview} alt="Preview" className="w-full max-h-64 object-contain" />
                             ) : (
                                <div className="flex items-center gap-3 p-4">
                                   <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center',
                                     mediaFile.type.startsWith('video/') ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-amber-500/10 border border-amber-500/20'
                                   )}>
                                     {mediaFile.type.startsWith('video/')
                                       ? <ImageIcon className="w-5 h-5 text-indigo-400" />
                                       : <ImageIcon className="w-5 h-5 text-amber-400" />}
                                   </div>
                                   <div>
                                     <p className="text-sm text-slate-200 font-semibold truncate max-w-[300px]">{mediaFile.name}</p>
                                     <p className="text-[10px] text-slate-500">{mediaFile.type.startsWith('video/') ? 'Video' : 'Audio'} adjunto</p>
                                   </div>
                                </div>
                             )}
                             <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Button variant="destructive" onClick={() => { setMediaFile(null); setMediaPreview(null); }} className="font-bold uppercase tracking-widest text-[10px]">
                                   <X className="w-4 h-4 mr-2" /> Quitar Archivo
                                </Button>
                             </div>
                          </div>
                       ) : (
                          <div className="border-2 border-dashed border-[#333336] rounded-2xl p-8 text-center hover:border-indigo-500/50 hover:bg-[#121214] transition-all cursor-pointer">
                             <input type="file" id="media-upload" className="hidden" accept="image/jpeg,image/png,image/webp,video/mp4,video/3gpp,audio/ogg,audio/mpeg,audio/mp4,audio/wav" onChange={handleMediaChange} disabled={sending} />
                             <label htmlFor="media-upload" className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
                                <UploadCloud className="w-10 h-10 text-slate-600 mb-3" />
                                <span className="text-sm font-bold text-slate-300">Añadir Imagen, Video o Audio</span>
                                <span className="text-[10px] text-slate-500 mt-1">JPG, PNG, WEBP, MP4, OGG, MP3 (máx 16MB)</span>
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
                          className="bg-[#121214] border-[#222225] text-sm min-h-[180px] focus:border-indigo-500 rounded-2xl resize-y custom-scrollbar text-slate-200 leading-relaxed p-5"
                          disabled={sending}
                       />
                       <div className="flex flex-wrap gap-2 pt-2">
                          <Badge variant="outline" className="text-[10px] py-1.5 px-3 border-[#333336] bg-[#161618] text-slate-400 cursor-pointer hover:bg-indigo-500/20 hover:text-indigo-400 transition-colors" onClick={() => setMessage(m => m + '{nombre}')}>+ Inyectar Nombre <code>{"{nombre}"}</code></Badge>
                          <Badge variant="outline" className="text-[10px] py-1.5 px-3 border-[#333336] bg-[#161618] text-slate-400 cursor-pointer hover:bg-indigo-500/20 hover:text-indigo-400 transition-colors" onClick={() => setMessage(m => m + '{ciudad}')}>+ Inyectar Ciudad <code>{"{ciudad}"}</code></Badge>
                       </div>
                    </div>

                    {/* VISTA PREVIA EN TIEMPO REAL */}
                    {message.trim() && (
                       <div className="mt-8 pt-6 border-t border-[#1a1a1a] animate-in fade-in duration-300">
                          <Label className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-2 mb-4">
                             <Eye className="w-3.5 h-3.5" /> Vista Previa (Simulando entrega a {previewContact.nombre?.split(' ')[0] || 'Cliente'})
                          </Label>
                          <div className="flex justify-end w-full">
                             <div className="max-w-[85%] flex flex-col items-end">
                                <div className="p-4 bg-[#161618] border border-[#222225] text-slate-100 rounded-2xl rounded-br-sm shadow-lg">
                                   {mediaPreview && (
                                      <div className="mb-3">
                                         <img src={mediaPreview} alt="Preview Adjunto" className="w-full max-w-[280px] rounded-lg border border-white/10" />
                                      </div>
                                   )}
                                   <p className="whitespace-pre-wrap text-sm leading-relaxed">{previewMessage}</p>
                                </div>
                                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mt-2 px-2">
                                   VISTA PREVIA • AHORA
                                </span>
                             </div>
                          </div>
                       </div>
                    )}
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
           {sendMode === 'SCHEDULE' ? (
               <div className="w-full flex justify-between">
                  <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl h-12 px-6 text-xs uppercase font-bold tracking-widest text-slate-400 hover:text-white hover:bg-[#222225]">Cancelar</Button>
                  <Button onClick={handleScheduleCampaign} disabled={sending || !campaignTitle || (!message.trim() && !mediaFile) || targetContacts.length === 0} className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-10 h-12 rounded-xl shadow-lg shadow-amber-900/20 uppercase tracking-widest text-[11px] transition-all active:scale-95">
                     {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <CalendarClock className="w-4 h-4 mr-2" />} Programar Campaña
                  </Button>
               </div>
           ) : !sending ? (
              <>
                 <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl h-12 px-6 text-xs uppercase font-bold tracking-widest text-slate-400 hover:text-white hover:bg-[#222225]">Cancelar</Button>
                 <Button onClick={handleStartNow} disabled={(!message.trim() && !mediaFile) || targetContacts.length === 0} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-10 h-12 rounded-xl shadow-lg shadow-indigo-900/20 uppercase tracking-widest text-[11px] transition-all active:scale-95">
                    <Play className="w-4 h-4 mr-2" /> Iniciar Ahora
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