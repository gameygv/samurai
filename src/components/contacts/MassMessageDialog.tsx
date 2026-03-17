"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Megaphone, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { sendEvolutionMessage } from '@/utils/messagingService';

interface MassMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetContacts: any[];
}

export const MassMessageDialog = ({ open, onOpenChange, targetContacts }: MassMessageDialogProps) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const handleSend = async () => {
     if (!message.trim()) return toast.error("El mensaje no puede estar vacío.");
     if (targetContacts.length === 0) return toast.error("No hay contactos seleccionados.");

     setSending(true);
     setProgress({ current: 0, total: targetContacts.length, success: 0, failed: 0 });
     
     let successCount = 0;
     let failCount = 0;

     for (let i = 0; i < targetContacts.length; i++) {
         const contact = targetContacts[i];
         
         if (contact.telefono) {
             try {
                 // Formato dinámico básico
                 const personalizedMsg = message.replace(/{nombre}/g, contact.nombre?.split(' ')[0] || 'amigo');
                 await sendEvolutionMessage(contact.telefono, personalizedMsg, contact.lead_id);
                 successCount++;
             } catch(e) {
                 failCount++;
             }
         } else {
             failCount++;
         }

         setProgress({ current: i + 1, total: targetContacts.length, success: successCount, failed: failCount });
         
         // DELAY ANTI-BAN: Pausa de 1.5 a 3 segundos entre mensajes
         if (i < targetContacts.length - 1) {
             const delay = Math.floor(Math.random() * 1500) + 1500; 
             await sleep(delay);
         }
     }
     
     toast.success(`Campaña finalizada: ${successCount} entregados, ${failCount} fallidos.`);
     setSending(false);
     setTimeout(() => {
        onOpenChange(false);
        setMessage('');
        setProgress({ current: 0, total: 0, success: 0, failed: 0 });
     }, 2000);
  };

  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(val) => !sending && onOpenChange(val)}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-400">
             <Megaphone className="w-5 h-5" /> Campaña Masiva
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
             Enviarás este mensaje a <strong className="text-white">{targetContacts.length}</strong> contactos. El sistema usará un retraso inteligente entre envíos para proteger tu número de WhatsApp.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-2 space-y-4">
           <Textarea 
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Hola {nombre}, te invito a nuestro próximo retiro..."
              className="bg-slate-950 border-slate-800 text-sm h-32 focus:border-indigo-500 rounded-xl resize-none"
              disabled={sending}
           />
           <p className="text-[10px] text-slate-500 italic">Variables: <strong className="text-indigo-400">{"{nombre}"}</strong>.</p>

           {sending && (
              <div className="space-y-2 bg-indigo-950/20 p-4 rounded-xl border border-indigo-900/50">
                 <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-indigo-300">
                    <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin"/> Enviando...</span>
                    <span>{progressPercent}%</span>
                 </div>
                 <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                 </div>
                 <div className="flex justify-between text-[9px] font-mono text-slate-400 pt-1">
                    <span className="text-emerald-400">Enviados: {progress.success}</span>
                    <span className="text-red-400">Fallidos: {progress.failed}</span>
                 </div>
              </div>
           )}
           
           {!sending && targetContacts.length > 50 && (
              <div className="flex items-start gap-2 bg-amber-900/10 border border-amber-500/20 p-3 rounded-xl text-[10px] text-amber-500">
                 <ShieldAlert className="w-4 h-4 shrink-0" />
                 <p>Estás a punto de enviar a más de 50 contactos. El proceso puede tardar varios minutos debido a la protección Anti-Spam. Por favor, <strong>no cierres esta ventana</strong> hasta que termine.</p>
              </div>
           )}
        </div>

        <DialogFooter>
           <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>Cancelar</Button>
           <Button onClick={handleSend} disabled={!message.trim() || sending || targetContacts.length === 0} className="bg-indigo-600 hover:bg-indigo-700 font-bold px-6 shadow-lg">
              {sending ? 'Procesando Campaña...' : <><Send className="w-4 h-4 mr-2" /> Lanzar Campaña</>}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};