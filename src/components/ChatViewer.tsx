import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ChatHeader } from './chat/ChatHeader';
import { MessageList } from './chat/MessageList';
import { MessageInput } from './chat/MessageInput';
import { MemoryPanel } from './chat/MemoryPanel';
import { AiSuggestions } from './chat/AiSuggestions';
import { toast } from 'sonner';
import { triggerMakeWebhook } from '@/utils/makeService';

interface ChatViewerProps {
  lead: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ChatViewer = ({ lead: initialLead, open, onOpenChange }: ChatViewerProps) => {
  const [lead, setLead] = useState(initialLead);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isEditingMemory, setIsEditingMemory] = useState(false);
  
  // AI Co-pilot state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  
  // Local Memory State
  const [memoryForm, setMemoryForm] = useState({
    nombre: '',
    email: '',
    summary: '',
    mood: 'NEUTRO',
    buying_intent: 'BAJO',
    followup_stage: 0,
    next_followup_at: null,
    ciudad: '',
    perfil_psicologico: ''
  });

  useEffect(() => {
     if (initialLead) {
        setLead(initialLead);
        updateMemoryForm(initialLead);
     }
  }, [initialLead]);

  useEffect(() => {
    if (open && lead?.id) {
      fetchMessages();
      
      const channel = supabase
        .channel(`lead-monitor-${lead.id}`)
        .on('postgres_changes', { 
           event: 'UPDATE', 
           schema: 'public', 
           table: 'leads', 
           filter: `id=eq.${lead.id}` 
        }, (payload) => {
           setLead(payload.new);
           updateMemoryForm(payload.new);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [open, lead?.id]);

  const updateMemoryForm = (data: any) => {
     setMemoryForm({
        nombre: data.nombre || '',
        email: data.email || '',
        summary: data.summary || '',
        mood: data.estado_emocional_actual || 'NEUTRO',
        buying_intent: data.buying_intent || 'BAJO',
        followup_stage: data.followup_stage || 0,
        next_followup_at: data.next_followup_at || null,
        ciudad: data.ciudad || '',
        perfil_psicologico: data.perfil_psicologico || ''
     });
  };

  const fetchLeadData = async () => {
     if (!lead?.id) return;
     const { data } = await supabase.from('leads').select('*').eq('id', lead.id).single();
     if (data) {
        setLead(data);
        updateMemoryForm(data);
     }
  };

  const fetchMessages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('conversaciones')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data);
      fetchAiSuggestions(data);
    }
    setLoading(false);
  };

  const fetchAiSuggestions = async (msgs: any[]) => {
    if (msgs.length === 0) return;
    setLoadingSuggestions(true);
    try {
      const transcript = msgs.slice(-10).map(m => `${m.emisor}: ${m.mensaje}`).join('\n');
      const { data } = await supabase.functions.invoke('get-ai-suggestions', {
        body: { lead_id: lead.id, transcript }
      });
      if (data?.suggestions) setSuggestions(data.suggestions);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    setSending(true);
    try {
      await supabase.from('conversaciones').insert({ lead_id: lead.id, mensaje: text, emisor: 'HUMANO', platform: 'PANEL' });
      await triggerMakeWebhook('webhook_sale', { type: 'outgoing_message', lead_id: lead.id, phone: lead.telefono, message: text, kommo_id: lead.kommo_id });
      fetchMessages();
      setDraftMessage('');
      if (text.includes('#STOP') || text.includes('#START')) {
         const isPaused = text.includes('#STOP');
         await supabase.from('leads').update({ ai_paused: isPaused }).eq('id', lead.id);
      }
    } finally {
      setSending(false);
    }
  };

  const saveMemory = async () => {
     setSending(true);
     try {
        await supabase.from('leads').update({
              nombre: memoryForm.nombre,
              email: memoryForm.email,
              summary: memoryForm.summary,
              estado_emocional_actual: memoryForm.mood,
              buying_intent: memoryForm.buying_intent,
              followup_stage: memoryForm.followup_stage,
              next_followup_at: memoryForm.next_followup_at,
              ciudad: memoryForm.ciudad,
              perfil_psicologico: memoryForm.perfil_psicologico
           }).eq('id', lead.id);
        toast.success('Cambios guardados');
        setIsEditingMemory(false);
     } finally {
        setSending(false);
     }
  };

  const handleToggleFollowup = () => handleSendMessage(lead.ai_paused ? '#START' : '#STOP');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-6xl flex flex-row bg-slate-950 border-l border-slate-800 text-white p-0 overflow-hidden">
        
        {/* Lado Izquierdo: Chat (Flexible con min-w-0 para no romper flex) */}
        <div className="flex-1 min-w-0 flex flex-col h-full bg-slate-950">
          <ChatHeader lead={lead} isAiPaused={lead.ai_paused} sending={sending} onSendCommand={handleSendMessage} />
          <MessageList messages={messages} loading={loading} />
          
          <div className="p-4 bg-slate-900/50 border-t border-slate-800">
            <AiSuggestions suggestions={suggestions} loading={loadingSuggestions} onSelect={setDraftMessage} onRefresh={() => fetchAiSuggestions(messages)} />
            <MessageInput onSendMessage={handleSendMessage} sending={sending} isAiPaused={lead.ai_paused} initialValue={draftMessage} />
          </div>
        </div>

        {/* Lado Derecho: Memoria (Ancho Fijo) */}
        <MemoryPanel 
          currentAnalysis={lead} 
          isEditing={isEditingMemory}
          setIsEditing={setIsEditingMemory}
          memoryForm={memoryForm}
          setMemoryForm={setMemoryForm}
          onSave={saveMemory}
          saving={sending}
          onReset={() => {}}
          onToggleFollowup={handleToggleFollowup}
          onAnalysisComplete={fetchLeadData}
        />
      </SheetContent>
    </Sheet>
  );
};

export default ChatViewer;