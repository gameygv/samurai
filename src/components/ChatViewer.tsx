import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { toast } from 'sonner';

import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageList } from '@/components/chat/MessageList';
import { MessageInput } from '@/components/chat/MessageInput';
import { MemoryPanel } from '@/components/chat/MemoryPanel';
import { ReportDialog } from '@/components/chat/ReportDialog';

interface ChatViewerProps {
  lead: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ChatViewer = ({ lead, open, onOpenChange }: ChatViewerProps) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isAiPaused, setIsAiPaused] = useState(false);
  
  // Memory State
  const [currentAnalysis, setCurrentAnalysis] = useState<any>(null);
  const [isEditingMemory, setIsEditingMemory] = useState(false);
  const [memoryForm, setMemoryForm] = useState({ mood: '', buying_intent: '', summary: '' });
  const [savingMemory, setSavingMemory] = useState(false);

  // Error Reporting State
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [errorContext, setErrorContext] = useState({ ia_response: '', correction: '', reason: '' });
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    if (open && lead) {
      fetchMessages();
      subscribeToMessages();
      setIsAiPaused(lead.ai_paused || false);
      
      const initialMemory = {
         mood: lead.estado_emocional_actual || 'NEUTRO',
         buying_intent: lead.buying_intent || 'BAJO',
         summary: lead.summary || ''
      };
      setCurrentAnalysis(initialMemory);
      setMemoryForm(initialMemory);
    }
  }, [open, lead]);

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('conversaciones')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: true });

    if (!error && data) {
       setMessages(data);
       // Refresh lead data for latest analysis
       const { data: freshLead } = await supabase.from('leads').select('*').eq('id', lead.id).single();
       if (freshLead) {
          const freshMemory = {
             mood: freshLead.estado_emocional_actual || 'NEUTRO',
             buying_intent: freshLead.buying_intent || 'BAJO',
             summary: freshLead.summary || ''
          };
          setCurrentAnalysis(freshMemory);
          setMemoryForm(freshMemory);
          setIsAiPaused(freshLead.ai_paused);
       }
    }
    setLoading(false);
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`chat:${lead.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversaciones', filter: `lead_id=eq.${lead.id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
        // Si el mensaje tiene análisis en metadata, actualizar vista
        if (payload.new.emisor === 'SAMURAI' && payload.new.metadata?.analysis && !isEditingMemory) {
           setCurrentAnalysis(payload.new.metadata.analysis);
           setMemoryForm(prev => ({ ...prev, ...payload.new.metadata.analysis }));
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads', filter: `id=eq.${lead.id}` }, (payload) => {
         setIsAiPaused(payload.new.ai_paused);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const sendCommand = async (cmd: string) => {
     setSending(true);
     try {
         const { error } = await supabase.from('conversaciones').insert({
             lead_id: lead.id,
             mensaje: cmd,
             emisor: 'HUMANO',
             platform: 'PANEL'
         });
         
         if (error) throw error;
         
         if (cmd.includes('#STOP')) setIsAiPaused(true);
         if (cmd.includes('#START')) setIsAiPaused(false);
         
         toast.success("Comando enviado.");
     } catch (err) {
         toast.error("Error enviando comando");
     } finally {
         setSending(false);
     }
  };

  const handleSendMessage = async (text: string) => {
    setSending(true);
    try {
      const { error } = await supabase.from('conversaciones').insert({
        lead_id: lead.id,
        mensaje: text,
        emisor: 'HUMANO',
        platform: 'PANEL'
      });

      if (error) throw error;
    } catch (error: any) {
      toast.error('Error enviando mensaje');
    } finally {
      setSending(false);
    }
  };

  const handleSaveMemory = async () => {
     setSavingMemory(true);
     try {
        const { error } = await supabase
           .from('leads')
           .update({
              estado_emocional_actual: memoryForm.mood,
              buying_intent: memoryForm.buying_intent,
              summary: memoryForm.summary,
              last_ai_analysis: new Date().toISOString()
           })
           .eq('id', lead.id);

        if (error) throw error;

        setCurrentAnalysis(memoryForm);
        setIsEditingMemory(false);
        toast.success("Memoria del Samurai actualizada manualmente.");
     } catch (err: any) {
        toast.error(err.message);
     } finally {
        setSavingMemory(false);
     }
  };

  const openReportDialog = () => {
     const lastAi = [...messages].reverse().find(m => m.emisor === 'SAMURAI');
     setErrorContext({
        ia_response: lastAi ? lastAi.mensaje : '',
        correction: '',
        reason: ''
     });
     setIsReportOpen(true);
  };

  const submitError = async () => {
     if (!errorContext.correction) return toast.error("Debes sugerir una corrección.");
     setReporting(true);
     
     const ciaCommand = `#CIA ${errorContext.correction}`;

     try {
        // 1. Enviar el comando al chat para que la IA lo vea de inmediato
        await supabase.from('conversaciones').insert({
           lead_id: lead.id,
           mensaje: ciaCommand,
           emisor: 'HUMANO',
           platform: 'PANEL'
        });

        // 2. Registrar en la bitácora para validación permanente
        const { error } = await supabase.from('errores_ia').insert({
           cliente_id: lead.id,
           mensaje_cliente: "Comando #CIA Manual",
           respuesta_ia: errorContext.ia_response,
           correccion_sugerida: errorContext.correction,
           categoria: 'CONDUCTA',
           severidad: 'ALTA',
           estado_correccion: 'REPORTADA'
        });

        if (error) throw error;
        toast.success("Comando #CIA enviado y registrado en Bitácora.");
        setIsReportOpen(false);
     } catch (err: any) {
        toast.error(err.message);
     } finally {
        setReporting(false);
     }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col bg-slate-950 border-l border-slate-800 text-white p-0 shadow-2xl sm:border-l">
        
        <ChatHeader 
            lead={lead} 
            isAiPaused={isAiPaused} 
            sending={sending} 
            onSendCommand={sendCommand} 
        />

        <div className="flex-1 flex overflow-hidden">
           {/* COLUMNA IZQUIERDA: CHAT */}
           <div className="flex-1 flex flex-col border-r border-slate-800 bg-slate-950/50">
              <MessageList messages={messages} loading={loading} />
              <MessageInput 
                onSendMessage={handleSendMessage} 
                sending={sending} 
                isAiPaused={isAiPaused} 
              />
           </div>

           {/* COLUMNA DERECHA: CEREBRO (MEMORIA) */}
           <MemoryPanel 
             currentAnalysis={currentAnalysis}
             isEditing={isEditingMemory}
             setIsEditing={setIsEditingMemory}
             memoryForm={memoryForm}
             setMemoryForm={setMemoryForm}
             onSave={handleSaveMemory}
             saving={savingMemory}
             onOpenReport={openReportDialog}
             onReset={() => setMemoryForm({...currentAnalysis, summary: ''})}
           />
        </div>

        <ReportDialog 
          open={isReportOpen}
          onOpenChange={setIsReportOpen}
          errorContext={errorContext}
          setErrorContext={setErrorContext}
          onSubmit={submitError}
          reporting={reporting}
        />

      </SheetContent>
    </Sheet>
  );
};

export default ChatViewer;