"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, Megaphone, ShieldAlert, Save, Clock, Users, Play, Pause, AlertTriangle, BookTemplate } from 'lucide-react';
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
  
  const [speed, setSpeed] = useState('NORMAL'); // SAFE, NORMAL, FAST
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

  const handleStart = async () => {
     if (!message.trim()) return toast.error("El mensaje no puede estar vacío.");
     if (targetContacts.length === 0) return toast.error("No hay contactos seleccionados.");

     setSending(true);
     setPaused(false);
     abortRef.current = false;
     
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
                 
                 await sendEvolutionMessage(contact.telefono, personalizedMsg, contact.lead_id);
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
      <DialogContent className="bg-[#0f0f11] border-[#222225] text-white max-w-2xl rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] p-0 overflow-hidden">
        <DialogHeader className="p-6 bg-[#161618] border-b border-[#222225]">
          <DialogTitle className="flex items-center gap-3 text-indigo-400 text-lg">
             <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20"><Megaphone className="w-5 h-5" /></div>
             Campaign Manager (Anti-Ban)
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs mt-1">
             Motor de difusión inteligente. Envía mensajes personalizados simulando comportamiento humano.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2">
           <div className="p-6 bg-[#0a0a0c] border-r border-[#222225] space-y-4">
              <div className="space-y-2">
                 <Label className="text-[10px] uppercase font-bold text-slate-500 flex items-center justify-between">
                    <span>Mensaje de Campaña</span>
                    <span className="text-indigo-400 font-mono">{message.length} chars</span>
                 </Label>
                 <Textarea 
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Hola {nombre}, tenemos una promoción en {ciudad}..."
                    className="bg-[#161618] border-[#222225] text-sm h-48 focus:border-indigo-500 rounded-xl resize-none custom-scrollbar text-slate-200"
                    disabled={sending}
                 />
                 <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="outline" className="text-[9px] border-[#333336] bg-[#161618] text-slate-400 cursor-pointer hover:bg-indigo-500/20 hover:text-indigo-400" onClick={() => setMessage(m => m + '{nombre}')}>+ {"{nombre}"}</Badge>
                    <Badge variant="outline" className="text-[9px] border-[#333336] bg-[#161618] text-slate-400 cursor-pointer hover:bg-indigo-500/20 hover:text-indigo-400" onClick={() => setMessage(m => m + '{ciudad}')}>+ {"{ciudad}"}</Badge>
                 </div>
              </div>

              {!sending && (
                 <div className="flex gap-2 pt-2 border-t border-[#222225]">
                    <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Nombre plantilla..." className="h-9 text-xs bg-[#161618] border-[#222225]" />
                    <Button onClick={saveTemplate} variant="outline" className="h-9 px-3 border-indigo-500/30 text-indigo-400 hover:bg-indigo-900/20"><Save className="w-3.5 h-3.5"/></Button>
                 </div>
              )}
           </div>

           <div className="p-6 bg-[#121214] flex flex-col space-y-6">
              
              {!sending ? (
                 <>
                    <div className="space-y-3">
                       <Label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-2"><BookTemplate className="w-3.5 h-3.5"/> Plantillas Guardadas</Label>
                       <ScrollArea className="h-32 bg-[#0a0a0c] border border-[#222225] rounded-xl p-2">
                          {templates.length === 0 ? (
                             <p className="text-center text-[10px] text-slate-500 mt-10">Sin plantillas</p>
                          ) : templates.map(t => (
                             <button key={t.id} onClick={() => setMessage(t.text)} className="w-full text-left p-2 hover:bg-[#161618] rounded-lg text-xs text-indigo-300 truncate mb-1 border border-transparent hover:border-[#333336]">
                                {t.name}
                             </button>
                          ))}
                       </ScrollArea>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-[#222225]">
                       <div className="flex justify-between items-center bg-[#0a0a0c] p-3 rounded-xl border border-[#222225]">
                          <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-2"><Users className="w-3.5 h-3.5"/> Audiencia:</span>
                          <span className="text-lg font-mono font-bold text-white">{targetContacts.length} <span className="text-[10px] text-slate-500">leads</span></span>
                       </div>

                       <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold text-slate-500">Modo de Envío (Protección WhatsApp)</Label>
                          <Select value={speed} onValueChange={setSpeed}>
                             <SelectTrigger className="bg-[#0a0a0c] border-[#222225] h-10 text-xs">
                                <SelectValue />
                             </SelectTrigger>
                             <SelectContent className="bg-[#161618] border-[#222225] text-white">
                                <SelectItem value="SAFE"><span className="text-emerald-400 font-bold">Seguro (Recomendado)</span> - 15 a 35 seg/msg</SelectItem>
                                <SelectItem value="NORMAL"><span className="text-amber-400 font-bold">Normal</span> - 8 a 15 seg/msg</SelectItem>
                                <SelectItem value="FAST"><span className="text-red-400 font-bold">Agresivo (Riesgo Ban)</span> - 3 a 8 seg/msg</SelectItem>
                             </SelectContent>
                          </Select>
                       </div>

                       <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <Clock className="w-3.5 h-3.5 text-indigo-400" />
                          Tiempo estimado: <span className="text-white font-bold">{eta} minutos</span>
                       </div>
                    </div>
                 </>
              ) : (
                 <div className="flex-1 flex flex-col justify-center space-y-6">
                    <div className="text-center space-y-2">
                       <h3 className="text-xl font-bold text-white uppercase tracking-widest">{progressPercent}%</h3>
                       <p className="text-xs text-slate-400 font-mono uppercase tracking-widest">
                          {paused ? 'PAUSADO' : 'TRANSMITIENDO...'}
                       </p>
                    </div>

                    <div className="space-y-2">
                       <div className="h-3 w-full bg-[#0a0a0c] rounded-full overflow-hidden border border-[#222225] shadow-inner">
                          <div className={cn("h-full transition-all duration-300", paused ? "bg-amber-500" : "bg-indigo-500")} style={{ width: `${progressPercent}%` }} />
                       </div>
                       <div className="flex justify-between text-[10px] font-mono font-bold tracking-widest">
                          <span className="text-emerald-400">{progress.success} Enviados</span>
                          <span className="text-slate-500">{progress.current} / {progress.total}</span>
                          <span className="text-red-400">{progress.failed} Errores</span>
                       </div>
                    </div>

                    <div className="p-4 bg-[#0a0a0c] border border-[#222225] rounded-xl flex items-start gap-3">
                       {paused ? <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" /> : <Loader2 className="w-5 h-5 text-indigo-500 animate-spin shrink-0" />}
                       <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-widest">
                          {paused ? "Campaña en pausa. No cierres la ventana si deseas continuar." : `Simulando escritura humana. Faltan ~${eta} min. Mantén esta pestaña abierta.`}
                       </p>
                    </div>
                 </div>
              )}
           </div>
        </div>

        <DialogFooter className="p-6 bg-[#161618] border-t border-[#222225] flex justify-between">
           {!sending ? (
              <>
                 <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl h-11 text-xs uppercase font-bold tracking-widest">Cancelar</Button>
                 <Button onClick={handleStart} disabled={!message.trim() || targetContacts.length === 0} className="bg-indigo-600 hover:bg-indigo-500 font-bold px-8 h-11 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">
                    <Play className="w-4 h-4 mr-2" /> Iniciar Transmisión
                 </Button>
              </>
           ) : (
              <div className="w-full flex gap-3 justify-end">
                 <Button variant="destructive" onClick={handleStop} className="h-11 rounded-xl font-bold uppercase tracking-widest text-[10px] bg-red-900/50 text-red-400 hover:bg-red-600 hover:text-white border border-red-900">
                    Abortar Misión
                 </Button>
                 {paused ? (
                    <Button onClick={() => setPaused(false)} className="bg-emerald-600 hover:bg-emerald-500 h-11 rounded-xl font-bold uppercase tracking-widest text-[10px] px-8">
                       <Play className="w-4 h-4 mr-2" /> Reanudar
                    </Button>
                 ) : (
                    <Button onClick={() => setPaused(true)} className="bg-amber-600 hover:bg-amber-500 text-slate-900 h-11 rounded-xl font-bold uppercase tracking-widest text-[10px] px-8">
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