import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ChatHeader } from './chat/ChatHeader';
import { MessageList } from './chat/MessageList';
import { MessageInput } from './chat/MessageInput';
import { MemoryPanel } from './chat/MemoryPanel';
import { ReportDialog } from './chat/ReportDialog';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

interface ChatViewerProps {
  lead: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ChatViewer = ({ lead, open, onOpenChange }: ChatViewerProps) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isEditingMemory, setIsEditingMemory] = useState(false);
  
  // States for reporting #CIA
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [errorContext, setErrorContext] = useState({
    ia_response: '',
    correction: '',
    reason: 'Corrección manual desde panel'
  });

  // Local Memory State
  const [memoryForm, setMemoryForm] = useState({
    summary: lead.summary || '',
    mood: lead.estado_emocional_actual || 'NEUTRO',
    buying_intent: lead.buying_intent || 'BAJO'
  });

  useEffect(() => {
    if (open && lead) {
      fetchMessages();
      setMemoryForm({
        summary: lead.summary || '',
        mood: lead.estado_emocional_actual || 'NEUTRO',
        buying_intent: lead.buying_intent || 'BAJO'
      });
    }
  }, [open, lead]);

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('conversaciones')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: true });

    if (!error && data) setMessages(data);
    setLoading(false);
  };

  const handleSendMessage = async (text: string) => {
    setSending(true);
    try {
      const { error } = await supabase.from('conversaciones').insert({
        lead_id: lead.id,
        mensaje: text,
        emisor: text.startsWith('#') ? 'SISTEMA' : 'HUMANO',
        platform: 'PANEL'
      });

      if (error) throw error;
      fetchMessages();
      
      // Si el mensaje es un comando #STOP o #START, actualizamos el lead localmente
      if (text.includes('#STOP') || text.includes('#START')) {
         const isPaused = text.includes('#STOP');
         await supabase.from('leads').update({ ai_paused: isPaused }).eq('id', lead.id);
         toast.success(isPaused ? 'IA Detenida' : 'IA Reactivada');
      }
    } catch (error: any) {
      toast.error('Error enviando mensaje');
    } finally {
      setSending(false);
    }
  };

  const saveMemory = async () => {
     setSending(true);
     try {
        const { error } = await supabase
           .from('leads')
           .update({
              summary: memoryForm.summary,
              estado_emocional_actual: memoryForm.mood,
              buying_intent: memoryForm.buying_intent
           })
           .eq('id', lead.id);
        
        if (error) throw error;
        toast.success('Memoria del Samurai actualizada');
        setIsEditingMemory(false);
     } catch (err: any) {
        toast.error(err.message);
     } finally {
        setSending(false);
     }
  };

  const handleToggleFollowup = async () => {
    try {
      const hasActiveFollowup = lead.next_followup_at && !lead.ai_paused;
      
      if (hasActiveFollowup) {
        // Pausar follow-ups
        await supabase.from('leads').update({
          next_followup_at: null,
          followup_stage: 0
        }).eq('id', lead.id);
        
        toast.success('Follow-ups pausados para este lead');
      } else {
        // Reanudar follow-ups
        const { data: config } = await supabase.from('followup_config').select('stage_1_delay').single();
        const delayMinutes = config?.stage_1_delay || 10;
        const nextTime = new Date(Date.now() + delayMinutes * 60 * 1000);
        
        await supabase.from('leads').update({
          next_followup_at: nextTime.toISOString(),
          followup_stage: 1
        }).eq('id', lead.id);
        
        toast.success('Follow-ups reactivados');
      }
      
      // Refrescar datos del lead
      onOpenChange(false);
      setTimeout(() => onOpenChange(true), 100);
      
    } catch (err: any) {
      toast.error('Error al modificar follow-ups');
    }
  };

  const handleReportCIA = async () => {
     setReporting(true);
     try {
        const { error } = await supabase.from('errores_ia').insert({
           cliente_id: lead.id,
           mensaje_cliente: messages.filter(m => m.emisor === 'CLIENTE').pop()?.mensaje || 'Contexto desconocido',
           respuesta_ia: errorContext.ia_response,
           correccion_sugerida: errorContext.correction,
           categoria: 'CONDUCTA',
           estado_correccion: 'REPORTADA'
        });

        if (error) throw error;

        await logActivity({
           action: 'CREATE',
           resource: 'BRAIN',
           description: `Nueva lección #CIA reportada para ${lead.nombre}`,
           status: 'OK'
        });

        toast.success('Lección reportada. Pendiente de validación en Bitácora.');
        setIsReportOpen(false);
     } catch (err: any) {
        toast.error(err.message);
     } finally {
        setReporting(false);
     }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-5xl flex flex-row bg-slate-950 border-l border-slate-800 text-white p-0 overflow-hidden">
        
        {/* CHAT AREA (LEFT/CENTER) */}
        <div className="flex-1 flex flex-col h-full bg-slate-950">
          <ChatHeader 
            lead={lead} 
            isAiPaused={lead.ai_paused} 
            sending={sending} 
            onSendCommand={handleSendMessage} 
          />
          
          <MessageList messages={messages} loading={loading} />
          
          <MessageInput 
            onSendMessage={handleSendMessage} 
            sending={sending} 
            isAiPaused={lead.ai_paused} 
          />
        </div>

        {/* MEMORY PANEL (RIGHT) */}
        <MemoryPanel 
          currentAnalysis={lead}
          isEditing={isEditingMemory}
          setIsEditing={setIsEditingMemory}
          memoryForm={memoryForm}
          setMemoryForm={setMemoryForm}
          onSave={saveMemory}
          saving={sending}
          onOpenReport={() => {
             const lastAi = messages.filter(m => m.emisor === 'SAMURAI').pop();
             setErrorContext({...errorContext, ia_response: lastAi?.mensaje || ''});
             setIsReportOpen(true);
          }}
          onReset={() => toast.info("Funcionalidad de reset en desarrollo")}
          onToggleFollowup={handleToggleFollowup}
        />

        {/* DIALOGS */}
        <ReportDialog 
          open={isReportOpen}
          onOpenChange={setIsReportOpen}
          errorContext={errorContext}
          setErrorContext={setErrorContext}
          onSubmit={handleReportCIA}
          reporting={reporting}
        />

      </SheetContent>
    </Sheet>
  );
};

export default ChatViewer;