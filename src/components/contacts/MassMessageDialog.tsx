"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Megaphone } from 'lucide-react';
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

  const handleSend = async () => {
     if (!message.trim()) return toast.error("El mensaje no puede estar vacío.");
     if (targetContacts.length === 0) return toast.error("No hay contactos seleccionados.");

     setSending(true);
     let successCount = 0;
     let failCount = 0;

     for (const contact of targetContacts) {
         if (contact.telefono) {
             try {
                 // Formato dinámico básico
                 const personalizedMsg = message.replace(/{nombre}/g, contact.nombre?.split(' ')[0] || 'amigo');
                 await sendEvolutionMessage(contact.telefono, personalizedMsg, contact.lead_id);
                 successCount++;
             } catch(e) {
                 failCount++;
             }
         }
     }
     
     toast.success(`Campaña enviada: ${successCount} entregados, ${failCount} fallidos.`);
     setSending(false);
     onOpenChange(false);
     setMessage('');
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !sending && onOpenChange(val)}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-400">
             <Megaphone className="w-5 h-5" /> Campaña Masiva
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
             Enviarás este mensaje a los <strong className="text-white">{targetContacts.length}</strong> contactos que tienes filtrados en la vista actual.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
           <Textarea 
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Hola {nombre}, te invito a nuestro próximo retiro..."
              className="bg-slate-950 border-slate-800 text-sm h-32 focus:border-indigo-500 rounded-xl resize-none"
              disabled={sending}
           />
           <p className="text-[10px] text-slate-500 italic">Puedes usar la variable <strong className="text-indigo-400">{"{nombre}"}</strong> para personalizar.</p>
        </div>

        <DialogFooter>
           <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>Cancelar</Button>
           <Button onClick={handleSend} disabled={!message.trim() || sending} className="bg-indigo-600 hover:bg-indigo-700 font-bold px-6 shadow-lg">
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />} 
              Lanzar Campaña
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};