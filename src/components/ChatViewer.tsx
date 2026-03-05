import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ChatHeader } from './chat/ChatHeader';
import { MessageList } from './chat/MessageList';
import { MessageInput } from './chat/MessageInput';
import { MemoryPanel } from './chat/MemoryPanel';
import { AiSuggestions } from './chat/AiSuggestions';
import { Button } from '@/components/ui/button';
import { Zap, CreditCard, Link as LinkIcon, FileText, X, Menu } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { sendEvolutionMessage } from '@/utils/messagingService';
import { cn } from '@/lib/utils';

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
  
  const [showMemoryMobile, setShowMemoryMobile] = useState(false);
  const [quickActions, setQuickActions] = useState<any>({});
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  
  const [memoryForm, setMemoryForm] = useState({
    nombre: '', apellido: '', email: '', summary: '', mood: 'NEUTRO', buying_intent: 'BAJO',
    followup_stage: 0, next_followup_at: null, ciudad: '', estado: '', cp: '', pais: 'mx',
    perfil_psicologico: '', main_pain: '', servicio_interes: '', origen_contacto: '', tiempo_compra: '', lead_score: 0
  });

  useEffect(() => {
     if (initialLead) {
        setLead(initialLead);
        updateMemoryForm(initialLead);
     }
     fetchQuickActions();
  }, [initialLead]);

  useEffect(() => {
    if (open && lead?.id) {
      fetchMessages();
      const channel = supabase.channel(`lead-monitor-${lead.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads', filter: `id=eq.${lead.id}` }, (payload) => {
           setLead(payload.new);
           updateMemoryForm(payload.new);
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [open, lead?.id]);

  const fetchQuickActions = async () => {
     const { data } = await supabase.from('app_config').select('key, value').in('key', ['wc_url', 'wc_product_id', 'bank_name', 'bank_account', 'bank_clabe', 'bank_holder']);
     if (data) {
        const config: any = data.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
        setQuickActions({
           paymentLink: `${config.wc_url || 'https://site.com'}/checkout/?add-to-cart=${config.wc_product_id || '0'}`,
           bankInfo: `Banco: ${config.bank_name}\nCuenta: ${config.bank_account}\nCLABE: ${config.bank_clabe}\nTitular: ${config.bank_holder}`
        });
     }
  };

  const updateMemoryForm = (data: any) => {
     setMemoryForm({
        nombre: data.nombre || '', apellido: data.apellido || '', email: data.email || '', summary: data.summary || '',
        mood: data.estado_emocional_actual || 'NEUTRO', buying_intent: data.buying_intent || 'BAJO',
        followup_stage: data.followup_stage || 0, next_followup_at: data.next_followup_at || null,
        ciudad: data.ciudad || '', estado: data.estado || '', cp: data.cp || '', pais: data.pais || 'mx',
        perfil_psicologico: data.perfil_psicologico || '', main_pain: data.main_pain || '',
        servicio_interes: data.servicio_interes || '', origen_contacto: data.origen_contacto || '',
        tiempo_compra: data.tiempo_compra || '', lead_score: data.lead_score || 0
     });
  };

  const fetchMessages = async () => {
    setLoading(true);
    const { data } = await supabase.from('conversaciones').select('*').eq('lead_id', lead.id).order('created_at', { ascending: true });
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
      const transcript = msgs.slice(-8).map(m => `${m.emisor}: ${m.mensaje}`).join('\n');
      const { data, error } = await supabase.functions.invoke('get-ai-suggestions', {
        body: { lead_id: lead.id, transcript }
      });
      if (!error && data?.suggestions) setSuggestions(data.suggestions);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    setSending(true);
    try {
      const apiResponse = await sendEvolutionMessage(lead.telefono, text);
      if (!apiResponse) { setSending(false); return; }

      await supabase.from('conversaciones').insert({ lead_id: lead.id, mensaje: text, emisor: 'HUMANO', platform: 'PANEL' });
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
        const { data: updatedLead, error } = await supabase.from('leads').update({
              nombre: memoryForm.nombre, apellido: memoryForm.apellido,
              email: memoryForm.email, summary: memoryForm.summary,
              estado_emocional_actual: memoryForm.mood, buying_intent: memoryForm.buying_intent,
              ciudad: memoryForm.ciudad, estado: memoryForm.estado,
              cp: memoryForm.cp, pais: memoryForm.pais,
              perfil_psicologico: memoryForm.perfil_psicologico,
              main_pain: memoryForm.main_pain, servicio_interes: memoryForm.servicio_interes,
              origen_contacto: memoryForm.origen_contacto, tiempo_compra: memoryForm.tiempo_compra,
              lead_score: memoryForm.lead_score
           }).eq('id', lead.id).select().single();

        if (error) throw error;

        // --- GATILLO REACTIVO CAPI ---
        // Si el humano completó el Email y antes no estaba disparado el evento Lead, forzamos análisis
        if (updatedLead.email && !updatedLead.capi_lead_event_sent_at) {
           console.log("[ChatViewer] Datos completados manualmente. Disparando análisis CAPI...");
           supabase.functions.invoke('analyze-leads', { body: { lead_id: lead.id, force: true } });
        }

        toast.success('Memoria del Samurai actualizada');
        setIsEditingMemory(false);
     } catch (err: any) {
        toast.error("Error al guardar: " + err.message);
     } finally {
        setSending(false);
     }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-6xl flex flex-col sm:flex-row bg-slate-950 border-l border-slate-800 text-white p-0 overflow-hidden">
        <div className={cn("flex-1 min-w-0 flex flex-col h-full bg-slate-950 transition-all", showMemoryMobile ? "hidden sm:flex" : "flex")}>
          <ChatHeader lead={lead} isAiPaused={lead.ai_paused} sending={sending} onSendCommand={handleSendMessage} />
          <MessageList messages={messages} loading={loading} />
          <div className="p-4 bg-slate-900/50 border-t border-slate-800 relative">
            <div className="absolute right-4 -top-12 flex gap-2">
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-8 w-8 p-0 rounded-full shadow-lg border border-indigo-500/50"><Zap className="w-4 h-4 text-white" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800 text-white w-56">
                     <DropdownMenuLabel className="text-[10px] uppercase text-slate-500 font-bold">Scripts de Cierre</DropdownMenuLabel>
                     <DropdownMenuSeparator className="bg-slate-800"/>
                     <DropdownMenuItem onClick={() => setDraftMessage(quickActions.paymentLink)} className="cursor-pointer hover:bg-indigo-600/20 text-xs"><LinkIcon className="w-3 h-3 mr-2 text-indigo-400" /> Link de Pago</DropdownMenuItem>
                     <DropdownMenuItem onClick={() => setDraftMessage(quickActions.bankInfo)} className="cursor-pointer hover:bg-indigo-600/20 text-xs"><CreditCard className="w-3 h-3 mr-2 text-indigo-400" /> Datos Bancarios</DropdownMenuItem>
                  </DropdownMenuContent>
               </DropdownMenu>
               <Button size="sm" variant="secondary" className="sm:hidden h-8 w-8 p-0 rounded-full border border-slate-700" onClick={() => setShowMemoryMobile(true)}><Menu className="w-4 h-4" /></Button>
            </div>
            <AiSuggestions suggestions={suggestions} loading={loadingSuggestions} onSelect={setDraftMessage} onRefresh={() => fetchAiSuggestions(messages)} />
            <MessageInput onSendMessage={handleSendMessage} sending={sending} isAiPaused={lead.ai_paused} initialValue={draftMessage} />
          </div>
        </div>
        <div className={cn("w-full sm:w-[380px] sm:min-w-[380px] flex-shrink-0 bg-slate-900/50 border-l border-slate-800 flex flex-col overflow-y-auto absolute sm:relative z-20 h-full transition-transform duration-300", showMemoryMobile ? "translate-x-0" : "translate-x-full sm:translate-x-0")}>
           <div className="sm:hidden p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
              <span className="font-bold text-sm">Ficha Táctica</span>
              <Button variant="ghost" size="sm" onClick={() => setShowMemoryMobile(false)}><X className="w-4 h-4" /></Button>
           </div>
           <MemoryPanel currentAnalysis={lead} isEditing={isEditingMemory} setIsEditing={setIsEditingMemory} memoryForm={memoryForm} setMemoryForm={setMemoryForm} onSave={saveMemory} saving={sending} onReset={() => {}} onToggleFollowup={() => handleSendMessage(lead.ai_paused ? '#START' : '#STOP')} onAnalysisComplete={fetchMessages} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ChatViewer;