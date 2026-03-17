import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Search, Loader2, MessageCircle, Bot, Zap, 
  CreditCard, MessageSquarePlus, Play, Pause, X, Menu, ShoppingCart, User, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MessageList } from '@/components/chat/MessageList';
import { MessageInput } from '@/components/chat/MessageInput';
import { MemoryPanel } from '@/components/chat/MemoryPanel';
import { AiSuggestions } from '@/components/chat/AiSuggestions';
import { sendEvolutionMessage } from '@/utils/messagingService';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";

const Inbox = () => {
  const { user, isAdmin } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<any[]>([]);
  const [activeLead, setActiveLead] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [sending, setSending] = useState(false);
  
  // Emergency Manual Input
  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
  const [manualClientText, setManualClientText] = useState("");
  const [processingManual, setProcessingManual] = useState(false);

  const [quickActions, setQuickActions] = useState<any>({});
  const [globalReplies, setGlobalReplies] = useState<any[]>([]);
  const [localReplies, setLocalReplies] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  
  const [isEditingMemory, setIsEditingMemory] = useState(false);
  const [showMemoryMobile, setShowMemoryMobile] = useState(false);
  const [memoryForm, setMemoryForm] = useState<any>({});

  const { messages, loading: loadingMessages, refetch: refetchMessages } = useRealtimeMessages(
    activeLead?.id || null,
    true
  );

  useEffect(() => {
    fetchLeads();
    fetchQuickActions();
    const channel = supabase.channel('inbox-leads-watch').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchLeads(false)).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (activeLead) {
       updateMemoryForm(activeLead);
       if (messages.length > 0) fetchAiSuggestions(activeLead.id, messages);
    }
  }, [activeLead?.id]);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    setFilteredLeads(leads.filter(l => l.nombre?.toLowerCase().includes(term) || l.telefono?.includes(term)));
  }, [searchTerm, leads]);

  const fetchLeads = async (showLoader = true) => {
    if (showLoader) setLoadingLeads(true);
    let query = supabase.from('leads').select('*').order('last_message_at', { ascending: false });
    if (!isAdmin) query = query.eq('assigned_to', user?.id);
    const { data } = await query;
    if (data) {
       setLeads(data);
       if (activeLead) {
          const updated = data.find(l => l.id === activeLead.id);
          if (updated) setActiveLead(updated);
       }
    }
    if (showLoader) setLoadingLeads(false);
  };

  const fetchQuickActions = async () => {
    if(!user) return;
    const { data } = await supabase.from('app_config').select('key, value').in('key', ['wc_url', 'bank_name', 'bank_account', 'bank_clabe', 'bank_holder', 'quick_replies', 'wc_products', `agent_templates_${user.id}`]);
    if (data) {
       const config: any = data.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
       setQuickActions({ wcBaseUrl: config.wc_url || '', bankInfo: `Banco: ${config.bank_name}\nCuenta: ${config.bank_account}\nCLABE: ${config.bank_clabe}\nTitular: ${config.bank_holder}` });
       try { if (config.quick_replies) setGlobalReplies(JSON.parse(config.quick_replies)); } catch (e) {}
       try { if (config[`agent_templates_${user.id}`]) setLocalReplies(JSON.parse(config[`agent_templates_${user.id}`])); } catch (e) {}
       try { if (config.wc_products) setProducts(JSON.parse(config.wc_products)); } catch (e) {}
    }
  };

  const fetchAiSuggestions = async (leadId: string, msgs: any[]) => {
    if (msgs.length === 0) return;
    setLoadingSuggestions(true);
    try {
      const transcript = msgs.slice(-8).map(m => `${m.emisor}: ${m.mensaje}`).join('\n');
      const { data, error } = await supabase.functions.invoke('get-ai-suggestions', { body: { lead_id: leadId, transcript } });
      if (!error && data?.suggestions) setSuggestions(data.suggestions);
    } catch (e) { console.error("AI Suggestion failed:", e); } finally { setLoadingSuggestions(false); }
  };

  const handleManualClientInput = async () => {
     if (!manualClientText.trim() || !activeLead) return;
     setProcessingManual(true);
     const tid = toast.loading("Procesando entrada de cliente...");
     
     try {
        // 1. Inyectar mensaje como si viniera de WhatsApp
        const { error: msgErr } = await supabase.from('conversaciones').insert({
           lead_id: activeLead.id,
           emisor: 'CLIENTE',
           mensaje: manualClientText,
           platform: 'MANUAL_EMERGENCY'
        });
        if (msgErr) throw msgErr;

        // 2. Llamar al procesador de respuesta de Samurai pasando parámetros en la URL
        await supabase.functions.invoke(`process-samurai-response?phone=${activeLead.telefono}&client_message=${encodeURIComponent(manualClientText)}`, {
            body: {}
        });

        toast.success("Mensaje procesado. Sam responderá en unos segundos.", { id: tid });
        setManualClientText("");
        setIsEmergencyOpen(false);
        refetchMessages();
     } catch (err: any) {
        toast.error("Error: " + err.message, { id: tid });
     } finally {
        setProcessingManual(false);
     }
  };

  const handleSendMessage = async (text: string, file?: File, isInternalNote: boolean = false) => {
    if (!activeLead) return;
    setSending(true);
    try {
      if (text.trim() === '#STOP' || text.trim() === '#START') {
         const isPaused = text.trim() === '#STOP';
         await supabase.from('leads').update({ ai_paused: isPaused }).eq('id', activeLead.id);
         await supabase.from('conversaciones').insert({ lead_id: activeLead.id, mensaje: `IA ${isPaused ? 'Pausada' : 'Activada'} manualmente.`, emisor: 'NOTA', platform: 'PANEL_INTERNO' });
         setDraftMessage(''); return;
      }
      if (isInternalNote) {
         await supabase.from('conversaciones').insert({ lead_id: activeLead.id, mensaje: text, emisor: 'NOTA', platform: 'PANEL_INTERNO' });
         setDraftMessage(''); return; 
      }
      let mediaData = undefined;
      if (file) {
        const ext = file.name.split('.').pop();
        const path = `chat_uploads/${Date.now()}.${ext}`;
        await supabase.storage.from('media').upload(path, file);
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
        mediaData = { url: publicUrl, type: file.type.startsWith('image/') ? 'image' : 'document', mimetype: file.type, name: file.name };
      }
      
      // CORRECCIÓN AQUÍ: activeLead.id posicionado correctamente antes de mediaData
      const apiResponse = await sendEvolutionMessage(activeLead.telefono, text, activeLead.id, mediaData);
      
      await supabase.from('conversaciones').insert({ 
        lead_id: activeLead.id, mensaje: apiResponse ? text : `[PRUEBA / WA DESCONECTADO] ${text}`, emisor: 'HUMANO', platform: 'PANEL',
        metadata: mediaData ? { mediaUrl: mediaData.url, mediaType: mediaData.type, fileName: mediaData.name } : {}
      });
      setDraftMessage('');
    } catch (err: any) { toast.error('Error: ' + err.message); } finally { setSending(false); }
  };

  const updateMemoryForm = (data: any) => {
    setMemoryForm({
       nombre: data.nombre || '', email: data.email || '', summary: data.summary || '',
       mood: data.estado_emocional_actual || 'NEUTRO', buying_intent: data.buying_intent || 'BAJO',
       ciudad: data.ciudad || '', perfil_psicologico: data.perfil_psicologico || '', assigned_to: data.assigned_to || '',
       tags: data.tags || [], reminders: data.reminders || []
    });
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

  const saveMemory = async () => {
    if (!activeLead) return;
    setSending(true);
    try {
       await supabase.from('leads').update({ ...memoryForm }).eq('id', activeLead.id);
       toast.success('Memoria actualizada');
       setIsEditingMemory(false);
    } catch (err: any) { toast.error("Error: " + err.message); } finally { setSending(false); }
  };

  return (
    <Layout>
      <div className="h-[calc(100vh-64px)] -m-4 md:-m-8 flex overflow-hidden bg-slate-950 border-t border-slate-800">
        
        {/* COLUMNA 1: LISTA */}
        <div className={cn("w-full md:w-80 flex-shrink-0 border-r border-slate-800 bg-[#0d0a08] flex flex-col", activeLead ? "hidden md:flex" : "flex")}>
           <div className="p-4 border-b border-slate-800 bg-slate-900/50 shrink-0">
               <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2"><MessageCircle className="w-4 h-4 text-indigo-400"/> Bandeja</h2>
               </div>
               <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9 bg-slate-950 border-slate-800 text-xs rounded-xl"/>
               </div>
           </div>
           <ScrollArea className="flex-1">
              {loadingLeads ? <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-slate-600"/></div>
              : <div className="divide-y divide-slate-800/50">
                    {filteredLeads.map(lead => (
                       <button key={lead.id} onClick={() => setActiveLead(lead)}
                         className={cn("w-full text-left p-3 hover:bg-slate-800/30 transition-colors flex items-start gap-3 relative", activeLead?.id === lead.id ? "bg-indigo-900/20" : "")}>
                          <Avatar className="h-10 w-10 border border-slate-700">
                               <AvatarFallback className="bg-slate-800 text-slate-300 font-bold">{lead.nombre?.substring(0,2).toUpperCase() || 'CL'}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                             <div className="flex justify-between items-baseline mb-0.5">
                                <span className={cn("font-bold truncate text-sm flex-1", activeLead?.id === lead.id ? "text-indigo-400" : "text-slate-200")}>{lead.nombre || lead.telefono}</span>
                             </div>
                             <p className="text-[11px] line-clamp-1 text-slate-400">{lead.summary || 'Sin interacción...'}</p>
                          </div>
                       </button>
                    ))}
                 </div>}
           </ScrollArea>
        </div>

        {/* COLUMNA 2: CHAT */}
        <div className={cn("flex-1 min-w-0 flex flex-col bg-slate-950 relative", !activeLead ? "hidden md:flex items-center justify-center" : "flex")}>
           {activeLead && (
              <>
                 <div className="h-16 px-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                       <div className="flex flex-col">
                          <span className="font-bold text-white">{activeLead.nombre || activeLead.telefono}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{activeLead.telefono}</span>
                       </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <Button variant="outline" size="sm" className="h-8 text-[10px] bg-red-900/10 border-red-500/30 text-red-400 font-bold uppercase tracking-widest" onClick={() => setIsEmergencyOpen(true)}>
                          <AlertTriangle className="w-3 h-3 mr-1.5"/> Fallo Webhook: Entrada Manual
                       </Button>
                       <Button variant="ghost" size="icon" className="xl:hidden text-slate-400" onClick={() => setShowMemoryMobile(!showMemoryMobile)}><Menu className="w-5 h-5" /></Button>
                    </div>
                 </div>

                 <MessageList messages={messages} loading={loadingMessages} />

                 <div className="p-3 bg-slate-900/80 border-t border-slate-800 shrink-0">
                    <AiSuggestions suggestions={suggestions} loading={loadingSuggestions} onSelect={setDraftMessage} onRefresh={() => fetchAiSuggestions(activeLead.id, messages)} />
                    <MessageInput onSendMessage={handleSendMessage} sending={sending} isAiPaused={activeLead.ai_paused} initialValue={draftMessage} onAutoGenerate={handleAutoGenerate} />
                 </div>
              </>
           )}
        </div>

        {/* COLUMNA 3: FICHA TÁCTICA */}
        {activeLead && (
           <div className={cn("w-full xl:w-[350px] flex-shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col absolute xl:relative z-20 h-full transition-transform duration-300", showMemoryMobile ? "translate-x-0" : "translate-x-full xl:translate-x-0")}>
              <MemoryPanel currentAnalysis={activeLead} isEditing={isEditingMemory} setIsEditing={setIsEditingMemory} memoryForm={memoryForm} setMemoryForm={setMemoryForm} onSave={saveMemory} saving={sending} onReset={() => {}} onToggleFollowup={() => handleSendMessage(activeLead.ai_paused ? '#START' : '#STOP')} />
           </div>
        )}
      </div>

      {/* DIALOGO DE EMERGENCIA */}
      <Dialog open={isEmergencyOpen} onOpenChange={setIsEmergencyOpen}>
         <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
            <DialogHeader>
               <DialogTitle className="text-red-400 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Modo Emergencia: Forzar Entrada Cliente</DialogTitle>
               <DialogDescription className="text-slate-400">
                  Usa esto si la API de WhatsApp no está enviando los mensajes a Samurai. Escribe lo que el cliente te puso y Sam responderá aquí.
               </DialogDescription>
            </DialogHeader>
            <div className="py-4">
               <textarea 
                  value={manualClientText}
                  onChange={e => setManualClientText(e.target.value)}
                  placeholder="Pega aquí lo que el cliente escribió en WhatsApp..."
                  className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 focus:border-indigo-500 focus:ring-0 outline-none resize-none"
               />
            </div>
            <DialogFooter>
               <Button variant="ghost" onClick={() => setIsEmergencyOpen(false)}>Cancelar</Button>
               <Button onClick={handleManualClientInput} disabled={processingManual || !manualClientText.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6">
                  {processingManual ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <User className="w-4 h-4 mr-2"/>}
                  Procesar como Cliente
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Inbox;