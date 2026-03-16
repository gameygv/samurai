import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ChatHeader } from './chat/ChatHeader';
import { MessageList } from './chat/MessageList';
import { MessageInput } from './chat/MessageInput';
import { MemoryPanel } from './chat/MemoryPanel';
import { AiSuggestions } from './chat/AiSuggestions';
import { Button } from '@/components/ui/button';
import { Zap, CreditCard, Link as LinkIcon, FileText, X, Menu, MessageSquarePlus, ShoppingCart } from 'lucide-react';
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
import { useAuth } from '@/context/AuthContext';

interface ChatViewerProps {
  lead: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ChatViewer = ({ lead: initialLead, open, onOpenChange }: ChatViewerProps) => {
  const { user } = useAuth();
  const [lead, setLead] = useState(initialLead);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isEditingMemory, setIsEditingMemory] = useState(false);
  
  const [showMemoryMobile, setShowMemoryMobile] = useState(false);
  const [quickActions, setQuickActions] = useState<any>({});
  const [quickReplies, setQuickReplies] = useState<{id: string, title: string, text: string}[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  
  const [memoryForm, setMemoryForm] = useState({
    nombre: '', apellido: '', email: '', summary: '', mood: 'NEUTRO', buying_intent: 'BAJO',
    followup_stage: 0, next_followup_at: null, ciudad: '', estado: '', cp: '', pais: 'mx',
    perfil_psicologico: '', main_pain: '', servicio_interes: '', origen_contacto: '', tiempo_compra: '', 
    lead_score: 0, assigned_to: '', tags: [] as string[]
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
     const { data } = await supabase.from('app_config').select('key, value').in('key', ['wc_url', 'bank_name', 'bank_account', 'bank_clabe', 'bank_holder', 'quick_replies', 'wc_products']);
     if (data) {
        const config: any = data.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
        
        setQuickActions({
           wcBaseUrl: config.wc_url || 'https://theelephantbowl.com',
           bankInfo: `Banco: ${config.bank_name}\nCuenta: ${config.bank_account}\nCLABE: ${config.bank_clabe}\nTitular: ${config.bank_holder}`
        });
        
        try { if (config.quick_replies) setQuickReplies(JSON.parse(config.quick_replies)); } catch (e) {}
        try { if (config.wc_products) setProducts(JSON.parse(config.wc_products)); } catch (e) {}
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
        tiempo_compra: data.tiempo_compra || '', lead_score: data.lead_score || 0, assigned_to: data.assigned_to || '',
        tags: data.tags || []
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

  const handleSendMessage = async (text: string, file?: File, isInternalNote: boolean = false) => {
    setSending(true);
    try {
      // 1. Intercepción de Comandos del Sistema
      if (text.trim() === '#STOP' || text.trim() === '#START') {
         const isPaused = text.trim() === '#STOP';
         await supabase.from('leads').update({ ai_paused: isPaused }).eq('id', lead.id);
         
         await supabase.from('conversaciones').insert({ 
           lead_id: lead.id, 
           mensaje: `IA ${isPaused ? 'Pausada' : 'Activada'} manualmente.`, 
           emisor: 'NOTA', 
           platform: 'PANEL_INTERNO' 
         });
         
         toast.success(`Samurai ${isPaused ? 'Pausado' : 'Activado'}`);
         fetchMessages();
         setDraftMessage('');
         return;
      }

      if (isInternalNote) {
         await supabase.from('conversaciones').insert({ 
           lead_id: lead.id, 
           mensaje: text, 
           emisor: 'NOTA', 
           platform: 'PANEL_INTERNO'
         });
         toast.success("Nota interna guardada.");
         fetchMessages();
         setDraftMessage('');
         return; 
      }

      let mediaData = undefined;

      if (file) {
        const ext = file.name.split('.').pop();
        const path = `chat_uploads/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        
        const { error: uploadErr } = await supabase.storage.from('media').upload(path, file);
        if (uploadErr) throw uploadErr;

        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);

        let type = 'document';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        else if (file.type.startsWith('audio/')) type = 'audio';

        mediaData = { url: publicUrl, type, mimetype: file.type, name: file.name };
      }

      const apiResponse = await sendEvolutionMessage(lead.telefono, text, mediaData);
      if (!apiResponse) { setSending(false); return; }

      await supabase.from('conversaciones').insert({ 
        lead_id: lead.id, 
        mensaje: text || (file ? `[ARCHIVO ENVIADO: ${file.name}]` : ''), 
        emisor: 'HUMANO', 
        platform: 'PANEL',
        metadata: mediaData ? { mediaUrl: mediaData.url, mediaType: mediaData.type, fileName: mediaData.name } : {}
      });

      // DISPARO SILENCIOSO DE AUDITORÍA QA PARA VENDEDORES
      if (user && text && !isInternalNote) {
          supabase.functions.invoke('evaluate-agent', {
              body: { agent_id: user.id, lead_id: lead.id, message_text: text }
          }).catch(e => console.error("Error silencioso QA:", e));
      }

      fetchMessages();
      setDraftMessage('');
    } catch (err: any) {
      toast.error('Error: ' + err.message);
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
              lead_score: memoryForm.lead_score, assigned_to: memoryForm.assigned_to || null,
              tags: memoryForm.tags
           }).eq('id', lead.id).select().single();

        if (error) throw error;

        if (updatedLead.email && !updatedLead.capi_lead_event_sent_at) {
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
          <ChatHeader lead={lead} isAiPaused={lead.ai_paused} sending={sending} onSendCommand={(cmd) => handleSendMessage(cmd)} />
          <MessageList messages={messages} loading={loading} />
          <div className="p-4 bg-slate-900/50 border-t border-slate-800 relative">
            <div className="absolute right-4 -top-12 flex gap-2">
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-8 w-8 p-0 rounded-full shadow-lg border border-indigo-500/50"><Zap className="w-4 h-4 text-white" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800 text-white w-64 max-h-[300px] overflow-y-auto custom-scrollbar">
                     <DropdownMenuLabel className="text-[10px] uppercase text-slate-500 font-bold">Catálogo de Cobro</DropdownMenuLabel>
                     
                     {products.length === 0 ? (
                         <DropdownMenuItem disabled className="text-[10px] italic text-slate-500">Sin productos configurados</DropdownMenuItem>
                     ) : products.map(p => (
                         <DropdownMenuItem 
                            key={p.id} 
                            onClick={() => setDraftMessage(`${quickActions.wcBaseUrl}/checkout/?add-to-cart=${p.wc_id}`)} 
                            className="cursor-pointer hover:bg-indigo-600/20 text-xs"
                         >
                            <ShoppingCart className="w-3 h-3 mr-2 text-indigo-400 shrink-0" />
                            <span className="truncate">{p.title}</span>
                         </DropdownMenuItem>
                     ))}

                     <DropdownMenuSeparator className="bg-slate-800 my-2"/>
                     <DropdownMenuItem onClick={() => setDraftMessage(quickActions.bankInfo)} className="cursor-pointer hover:bg-indigo-600/20 text-xs"><CreditCard className="w-3 h-3 mr-2 text-indigo-400" /> Datos Bancarios</DropdownMenuItem>
                     
                     {quickReplies.length > 0 && (
                        <>
                           <DropdownMenuSeparator className="bg-slate-800 my-2"/>
                           <DropdownMenuLabel className="text-[10px] uppercase text-slate-500 font-bold">Plantillas Rápidas</DropdownMenuLabel>
                           {quickReplies.map((qr) => (
                              <DropdownMenuItem key={qr.id} onClick={() => setDraftMessage(qr.text)} className="cursor-pointer hover:bg-indigo-600/20 text-xs">
                                 <MessageSquarePlus className="w-3 h-3 mr-2 text-indigo-400 shrink-0" />
                                 <span className="truncate">{qr.title}</span>
                              </DropdownMenuItem>
                           ))}
                        </>
                     )}
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
           <MemoryPanel currentAnalysis={lead} isEditing={isEditingMemory} setIsEditing={setIsEditingMemory} memoryForm={memoryForm} setMemoryForm={setMemoryForm} onSave={saveMemory} saving={sending} onReset={() => {}} onToggleFollowup={() => handleSendMessage(lead.ai_paused ? '#START' : '#STOP')} onAnalysisComplete={() => fetchMessages()} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ChatViewer;