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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  
  // Combined Templates
  const [globalReplies, setGlobalReplies] = useState<{id: string, title: string, text: string}[]>([]);
  const [localReplies, setLocalReplies] = useState<{id: string, title: string, text: string}[]>([]);
  
  const [products, setProducts] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  
  const [memoryForm, setMemoryForm] = useState({
    nombre: '', apellido: '', email: '', summary: '', mood: 'NEUTRO', buying_intent: 'BAJO',
    followup_stage: 0, next_followup_at: null, ciudad: '', estado: '', cp: '', pais: 'mx',
    perfil_psicologico: '', main_pain: '', servicio_interes: '', origen_contacto: '', tiempo_compra: '', 
    lead_score: 0, assigned_to: '', tags: [], reminders: []
  });

  useEffect(() => {
     if (initialLead) {
        setLead(initialLead);
        updateMemoryForm(initialLead);
     }
     fetchQuickActions();
  }, [initialLead]);

  useEffect(() => {
    let leadChannel: any;
    let msgChannel: any;
    let pollInterval: NodeJS.Timeout;

    if (open && lead?.id) {
      fetchMessages();
      
      const uniqueId = Math.random().toString(36).substring(7);
      
      leadChannel = supabase.channel(`lead-watch-${lead.id}-${uniqueId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads', filter: `id=eq.${lead.id}` }, (payload) => {
           setLead(payload.new);
           updateMemoryForm(payload.new);
        }).subscribe();
        
      msgChannel = supabase.channel(`msg-watch-${lead.id}-${uniqueId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversaciones', filter: `lead_id=eq.${lead.id}` }, (payload) => {
           setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]);
        }).subscribe();

      pollInterval = setInterval(async () => {
         const { data } = await supabase.from('conversaciones').select('*').eq('lead_id', lead.id).order('created_at', { ascending: true });
         if (data) setMessages(prev => prev.length === data.length ? prev : data);
      }, 2500);
    }

    return () => { 
        if (leadChannel) supabase.removeChannel(leadChannel); 
        if (msgChannel) supabase.removeChannel(msgChannel);
        if (pollInterval) clearInterval(pollInterval);
    };
  }, [open, lead?.id]);

  const fetchQuickActions = async () => {
     if(!user) return;
     const { data } = await supabase.from('app_config').select('key, value').in('key', ['wc_url', 'bank_name', 'bank_account', 'bank_clabe', 'bank_holder', 'quick_replies', 'wc_products', `agent_templates_${user.id}`]);
     if (data) {
        const config: any = data.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
        setQuickActions({
           wcBaseUrl: config.wc_url || 'https://theelephantbowl.com',
           bankInfo: `Banco: ${config.bank_name}\nCuenta: ${config.bank_account}\nCLABE: ${config.bank_clabe}\nTitular: ${config.bank_holder}`
        });
        try { if (config.quick_replies) setGlobalReplies(JSON.parse(config.quick_replies)); } catch (e) {}
        try { if (config[`agent_templates_${user.id}`]) setLocalReplies(JSON.parse(config[`agent_templates_${user.id}`])); } catch (e) {}
        try { if (config.wc_products) setProducts(JSON.parse(config.wc_products)); } catch (e) {}
     }
  };

  const updateMemoryForm = (data: any) => {
     let rems = [];
     try { rems = data.reminders ? (typeof data.reminders === 'string' ? JSON.parse(data.reminders) : data.reminders) : []; } catch(e){}
     
     setMemoryForm({
        nombre: data.nombre || '', apellido: data.apellido || '', email: data.email || '', summary: data.summary || '',
        mood: data.estado_emocional_actual || 'NEUTRO', buying_intent: data.buying_intent || 'BAJO',
        followup_stage: data.followup_stage || 0, next_followup_at: data.next_followup_at || null,
        ciudad: data.ciudad || '', estado: data.estado || '', cp: data.cp || '', pais: data.pais || 'mx',
        perfil_psicologico: data.perfil_psicologico || '', main_pain: data.main_pain || '',
        servicio_interes: data.servicio_interes || '', origen_contacto: data.origen_contacto || '',
        tiempo_compra: data.tiempo_compra || '', lead_score: data.lead_score || 0, assigned_to: data.assigned_to || '',
        tags: data.tags || [], reminders: rems
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
      const { data, error } = await supabase.functions.invoke('get-ai-suggestions', { body: { lead_id: lead.id, transcript } });
      if (!error && data?.suggestions) setSuggestions(data.suggestions);
    } finally { setLoadingSuggestions(false); }
  };

  const handleAutoGenerate = async () => {
      try {
         const history = messages.slice(-15).map(m => ({ 
             role: (m.emisor === 'IA' || m.emisor === 'SAMURAI' ? 'bot' : 'user'), 
             text: m.mensaje 
         }));
         const { data, error } = await supabase.functions.invoke('simulate-samurai', {
            body: { question: "Por favor genera la mejor respuesta corta y persuasiva para continuar esta conversación como un experto humano.", history, customPrompts: null }
         });
         if (error) throw error;
         return data.answer as string;
      } catch (e) {
         console.error(e);
         return null;
      }
  };

  const handleDeleteLead = async () => {
    const tid = toast.loading("Eliminando prospecto...");
    try {
       await supabase.from('conversaciones').delete().eq('lead_id', lead.id);
       await supabase.from('leads').delete().eq('id', lead.id);
       toast.success("Prospecto eliminado correctamente.", { id: tid });
       onOpenChange(false);
    } catch (err: any) { toast.error("Error al eliminar: " + err.message, { id: tid }); }
  };

  const handleSendMessage = async (text: string, file?: File, isInternalNote: boolean = false) => {
    setSending(true);
    try {
      if (text.trim() === '#STOP' || text.trim() === '#START') {
         const isPaused = text.trim() === '#STOP';
         await supabase.from('leads').update({ ai_paused: isPaused }).eq('id', lead.id);
         await supabase.from('conversaciones').insert({ lead_id: lead.id, mensaje: `IA ${isPaused ? 'Pausada' : 'Activada'} manualmente.`, emisor: 'NOTA', platform: 'PANEL_INTERNO' });
         toast.success(`Samurai ${isPaused ? 'Pausado' : 'Activado'}`);
         setDraftMessage('');
         return;
      }

      if (isInternalNote) {
         await supabase.from('conversaciones').insert({ lead_id: lead.id, mensaje: text, emisor: 'NOTA', platform: 'PANEL_INTERNO' });
         toast.success("Nota guardada.");
         setDraftMessage('');
         return; 
      }

      let mediaData = undefined;
      if (file) {
        const ext = file.name.split('.').pop();
        const path = `chat_uploads/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('media').upload(path, file);
        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
        let type = 'document';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        mediaData = { url: publicUrl, type, mimetype: file.type, name: file.name };
      }

      // CORRECCIÓN AQUÍ: lead.id posicionado correctamente antes de mediaData
      const apiResponse = await sendEvolutionMessage(lead.telefono, text, lead.id, mediaData);
      
      const textToSave = text || (file ? `[ARCHIVO ENVIADO: ${file.name}]` : '');
      const finalMessage = apiResponse ? textToSave : `[PRUEBA / WA DESCONECTADO] ${textToSave}`;

      await supabase.from('conversaciones').insert({ 
        lead_id: lead.id, mensaje: finalMessage, emisor: 'HUMANO', platform: 'PANEL',
        metadata: mediaData ? { mediaUrl: mediaData.url, mediaType: mediaData.type, fileName: mediaData.name } : {}
      });

      if (user && text) {
          supabase.functions.invoke('evaluate-agent', { body: { agent_id: user.id, lead_id: lead.id, message_text: text } }).catch(() => {});
      }

      setDraftMessage('');
    } catch (err: any) { toast.error('Error: ' + err.message); } finally { setSending(false); }
  };

  const saveMemory = async () => {
     setSending(true);
     try {
        const { data: updatedLead, error } = await supabase.from('leads').update({
              nombre: memoryForm.nombre, apellido: memoryForm.apellido, email: memoryForm.email, summary: memoryForm.summary,
              estado_emocional_actual: memoryForm.mood, buying_intent: memoryForm.buying_intent,
              ciudad: memoryForm.ciudad, estado: memoryForm.estado, cp: memoryForm.cp, pais: memoryForm.pais,
              perfil_psicologico: memoryForm.perfil_psicologico, main_pain: memoryForm.main_pain, servicio_interes: memoryForm.servicio_interes,
              origen_contacto: memoryForm.origen_contacto, tiempo_compra: memoryForm.tiempo_compra,
              lead_score: memoryForm.lead_score, assigned_to: memoryForm.assigned_to || null,
              tags: memoryForm.tags, reminders: memoryForm.reminders
           }).eq('id', lead.id).select().single();

        if (error) throw error;
        if (updatedLead.email && !updatedLead.capi_lead_event_sent_at) {
           supabase.functions.invoke('analyze-leads', { body: { lead_id: lead.id, force: true } });
        }
        toast.success('Memoria actualizada');
        setIsEditingMemory(false);
     } catch (err: any) { toast.error("Error al guardar: " + err.message); } finally { setSending(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-6xl flex flex-col sm:flex-row bg-slate-950 border-l border-slate-800 text-white p-0 overflow-hidden">
        <div className={cn("flex-1 min-w-0 flex flex-col h-full bg-slate-950 transition-all", showMemoryMobile ? "hidden sm:flex" : "flex")}>
          <ChatHeader lead={lead} isAiPaused={lead.ai_paused} sending={sending} onSendCommand={(cmd) => handleSendMessage(cmd)} />
          <MessageList messages={messages} loading={loading} />
          
          <div className="p-3 bg-slate-900/80 border-t border-slate-800 shrink-0">
             <AiSuggestions suggestions={suggestions} loading={loadingSuggestions} onSelect={setDraftMessage} onRefresh={() => fetchAiSuggestions(messages)} />
             
             <MessageInput 
                onSendMessage={handleSendMessage} 
                sending={sending} 
                isAiPaused={lead.ai_paused} 
                initialValue={draftMessage} 
                onAutoGenerate={handleAutoGenerate}
                toolbarAction={
                   <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                         <Button size="sm" variant="outline" className="h-8 text-[10px] bg-slate-950 border-slate-700 text-amber-500 uppercase font-bold tracking-widest rounded-lg">
                            <Zap className="w-3 h-3 mr-1.5" /> Plantillas
                         </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="bg-slate-900 border-slate-800 text-white w-64 max-h-[300px] overflow-y-auto">
                         <DropdownMenuLabel className="text-[10px] uppercase text-slate-500 font-bold">Catálogo</DropdownMenuLabel>
                         {products.map(p => (
                             <DropdownMenuItem key={p.id} onClick={() => setDraftMessage(`${quickActions.wcBaseUrl}/checkout/?add-to-cart=${p.wc_id}`)} className="cursor-pointer text-xs">
                                <ShoppingCart className="w-3 h-3 mr-2 text-indigo-400 shrink-0" /><span className="truncate">{p.title}</span>
                             </DropdownMenuItem>
                         ))}
                         <DropdownMenuSeparator className="bg-slate-800 my-2"/>
                         <DropdownMenuItem onClick={() => setDraftMessage(quickActions.bankInfo)} className="cursor-pointer text-xs"><CreditCard className="w-3 h-3 mr-2 text-indigo-400" /> Datos Bancarios</DropdownMenuItem>
                         
                         {globalReplies.length > 0 && <>
                            <DropdownMenuSeparator className="bg-slate-800 my-2"/>
                            <DropdownMenuLabel className="text-[10px] uppercase text-slate-500 font-bold">Plantillas Globales</DropdownMenuLabel>
                            {globalReplies.map((qr) => (
                               <DropdownMenuItem key={qr.id} onClick={() => setDraftMessage(qr.text)} className="cursor-pointer text-xs">
                                  <MessageSquarePlus className="w-3 h-3 mr-2 text-indigo-400 shrink-0" /><span className="truncate">{qr.title}</span>
                               </DropdownMenuItem>
                            ))}
                         </>}

                         {localReplies.length > 0 && <>
                            <DropdownMenuSeparator className="bg-slate-800 my-2"/>
                            <DropdownMenuLabel className="text-[10px] uppercase text-slate-500 font-bold">Mis Plantillas Privadas</DropdownMenuLabel>
                            {localReplies.map((qr) => (
                               <DropdownMenuItem key={qr.id} onClick={() => setDraftMessage(qr.text)} className="cursor-pointer text-xs">
                                  <MessageSquarePlus className="w-3 h-3 mr-2 text-amber-500 shrink-0" /><span className="truncate">{qr.title}</span>
                               </DropdownMenuItem>
                            ))}
                         </>}
                      </DropdownMenuContent>
                   </DropdownMenu>
                }
             />
             <Button variant="ghost" size="icon" className="sm:hidden absolute top-4 right-4 text-slate-400" onClick={() => setShowMemoryMobile(true)}><Menu className="w-5 h-5" /></Button>
          </div>
        </div>

        <div className={cn("w-full sm:w-[380px] sm:min-w-[380px] flex-shrink-0 bg-slate-900/50 border-l border-slate-800 flex flex-col overflow-y-auto absolute sm:relative z-20 h-full transition-transform duration-300", showMemoryMobile ? "translate-x-0" : "translate-x-full sm:translate-x-0")}>
           <div className="sm:hidden p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
              <span className="font-bold text-sm">Ficha Táctica</span>
              <Button variant="ghost" size="sm" onClick={() => setShowMemoryMobile(false)}><X className="w-4 h-4" /></Button>
           </div>
           <MemoryPanel 
              currentAnalysis={lead} 
              isEditing={isEditingMemory} 
              setIsEditing={setIsEditingMemory} 
              memoryForm={memoryForm} 
              setMemoryForm={setMemoryForm} 
              onSave={saveMemory} 
              saving={sending} 
              onReset={() => {}} 
              onToggleFollowup={() => handleSendMessage(lead.ai_paused ? '#START' : '#STOP')} 
              onAnalysisComplete={() => fetchMessages()} 
              onDeleteLead={handleDeleteLead}
           />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ChatViewer;