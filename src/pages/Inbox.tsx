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
  CreditCard, MessageSquarePlus, Play, Pause, X, Menu, ShoppingCart, User, AlertTriangle, MapPin, Mail, Tag, Globe, ChevronLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MessageList } from '@/components/chat/MessageList';
import { MessageInput } from '@/components/chat/MessageInput';
import { MemoryPanel } from '@/components/chat/MemoryPanel';
import { AiSuggestions } from '@/components/chat/AiSuggestions';
import { GlobalAiToggle } from '@/components/chat/GlobalAiToggle';
import { sendEvolutionMessage } from '@/utils/messagingService';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import { extractTagText } from '@/lib/tag-parser';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Inbox = () => {
  const { user, isManager, profile } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<any[]>([]);
  const [activeLead, setActiveLead] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [sending, setSending] = useState(false);
  
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
  
  const [localTags, setLocalTags] = useState<{id: string, text: string, color: string}[]>([]);
  const [globalTags, setGlobalTags] = useState<{id: string, text: string, color: string}[]>([]);

  const { messages, loading: loadingMessages, refetch: refetchMessages } = useRealtimeMessages(
    activeLead?.id || null,
    true
  );

  useEffect(() => {
    fetchLeads();
    fetchQuickActions();
    if (user) fetchTags();
    
    const channel = supabase.channel('inbox-leads-watch').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchLeads(false)).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (activeLead) {
       updateMemoryForm(activeLead);
       if (messages && messages.length > 0) fetchAiSuggestions(activeLead.id, messages);
    }
  }, [activeLead?.id]);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    setFilteredLeads(leads.filter(l => {
      const leadName = String(l.nombre || '').toLowerCase();
      const leadPhone = String(l.telefono || '');
      const leadCity = String(l.ciudad || '').toLowerCase();
      const contactTags = Array.isArray(l.tags) ? l.tags.map(extractTagText) : [];
      
      return leadName.includes(term) || 
             leadPhone.includes(term) || 
             leadCity.includes(term) ||
             contactTags.some((t: string) => t.toLowerCase().includes(term));
    }));
  }, [searchTerm, leads]);

  const fetchLeads = async (showLoader = true) => {
    if (showLoader) setLoadingLeads(true);
    let query = supabase.from('leads').select('*').order('last_message_at', { ascending: false });
    if (!isManager) query = query.eq('assigned_to', user?.id);
    
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

  const fetchTags = async () => {
     if(!user) return;
     const { data } = await supabase.from('app_config').select('key, value').in('key', [`agent_tags_${user.id}`, 'global_tags']);
     if (data) {
        const local = data.find(d => d.key === `agent_tags_${user.id}`)?.value;
        const global = data.find(d => d.key === 'global_tags')?.value;
        if (local) { try { const parsed = JSON.parse(local); if (Array.isArray(parsed)) setLocalTags(parsed); } catch(e) {} }
        if (global) { try { const parsed = JSON.parse(global); if (Array.isArray(parsed)) setGlobalTags(parsed); } catch(e) {} }
     }
  };

  const fetchQuickActions = async () => {
    if(!user) return;
    const { data } = await supabase.from('app_config').select('key, value').in('key', ['wc_url', 'bank_name', 'bank_account', 'bank_clabe', 'bank_holder', 'quick_replies', 'wc_products', `agent_templates_${user.id}`, `agent_bank_${user.id}`]);
    if (data) {
       const config: any = data.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
       
       let finalBankInfo = `Banco: ${config.bank_name}\nCuenta: ${config.bank_account}\nCLABE: ${config.bank_clabe}\nTitular: ${config.bank_holder}`;
       
       if (config[`agent_bank_${user.id}`]) {
           try {
               const agentBank = JSON.parse(config[`agent_bank_${user.id}`]);
               if (agentBank.enabled) {
                   finalBankInfo = `Banco: ${agentBank.bank_name}\nCuenta: ${agentBank.bank_account}\nCLABE: ${agentBank.bank_clabe}\nTitular: ${agentBank.bank_holder}`;
               }
           } catch(e) {}
       }

       setQuickActions({ wcBaseUrl: config.wc_url || '', bankInfo: finalBankInfo });
       
       try { if (config.quick_replies) { const parsed = JSON.parse(config.quick_replies); if (Array.isArray(parsed)) setGlobalReplies(parsed); } } catch (e) {}
       try { if (config[`agent_templates_${user.id}`]) { const parsed = JSON.parse(config[`agent_templates_${user.id}`]); if (Array.isArray(parsed)) setLocalReplies(parsed); } } catch (e) {}
       try { if (config.wc_products) { const parsed = JSON.parse(config.wc_products); if (Array.isArray(parsed)) setProducts(parsed); } } catch (e) {}
    }
  };

  const fetchAiSuggestions = async (leadId: string, msgs: any[]) => {
    if (!msgs || msgs.length === 0) return;
    setLoadingSuggestions(true);
    try {
      const transcript = msgs.slice(-8).map(m => `${m.emisor}: ${m.mensaje}`).join('\n');
      const { data, error } = await supabase.functions.invoke('get-ai-suggestions', { body: { lead_id: leadId, transcript } });
      if (!error && data?.suggestions && Array.isArray(data.suggestions)) {
         setSuggestions(data.suggestions);
      }
    } catch (e) { console.error("AI Suggestion failed:", e); } finally { setLoadingSuggestions(false); }
  };

  const handleSendMessage = async (text: string, file?: File, isInternalNote: boolean = false) => {
    if (!activeLead) return;
    setSending(true);
    try {
      const cmd = text.trim().toUpperCase();
      if (cmd === '#STOP') {
         await supabase.from('leads').update({ ai_paused: true }).eq('id', activeLead.id);
         await supabase.from('conversaciones').insert({ lead_id: activeLead.id, mensaje: `IA Pausada manualmente.`, emisor: 'HUMANO', platform: 'PANEL_INTERNO' });
         toast.success(`Samurai Pausado ⏸`);
         refetchMessages();
         return;
      }
      if (cmd === '#START') {
         await supabase.from('leads').update({ ai_paused: false }).eq('id', activeLead.id);
         await supabase.from('conversaciones').insert({ lead_id: activeLead.id, mensaje: `IA Activada manualmente.`, emisor: 'HUMANO', platform: 'PANEL_INTERNO' });
         toast.success(`Samurai Activado ✅`);
         refetchMessages();
         return;
      }

      if (isInternalNote) {
         await supabase.from('conversaciones').insert({ 
             lead_id: activeLead.id, 
             mensaje: text, 
             emisor: 'HUMANO', 
             platform: 'PANEL_INTERNO',
             metadata: { author: profile?.full_name || 'Agente' }
         });
         toast.success("Nota guardada.");
         setDraftMessage('');
         refetchMessages();
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

      await sendEvolutionMessage(activeLead.telefono, text, activeLead.id, mediaData);
      
      await supabase.from('conversaciones').insert({ 
        lead_id: activeLead.id, mensaje: text || (file ? `[ARCHIVO ENVIADO: ${file.name}]` : ''), emisor: 'HUMANO', platform: 'PANEL',
        metadata: mediaData ? { mediaUrl: mediaData.url, mediaType: mediaData.type, fileName: mediaData.name } : {}
      });

      if (user && text) {
          supabase.functions.invoke('evaluate-agent', { body: { agent_id: user.id, lead_id: activeLead.id, message_text: text } }).catch(() => {});
      }
      setDraftMessage('');
      refetchMessages();
    } catch (err: any) { toast.error('Error: ' + err.message); } finally { setSending(false); }
  };

  const updateMemoryForm = (data: any) => {
    let rems = [];
    try { rems = data.reminders ? (typeof data.reminders === 'string' ? JSON.parse(data.reminders) : data.reminders) : []; } catch(e){}
    setMemoryForm({
       nombre: String(data.nombre || ''), email: String(data.email || ''), summary: String(data.summary || ''),
       mood: String(data.estado_emocional_actual || 'NEUTRO'), buying_intent: String(data.buying_intent || 'BAJO'),
       ciudad: String(data.ciudad || ''), perfil_psicologico: String(data.perfil_psicologico || ''), assigned_to: data.assigned_to || '',
       tags: Array.isArray(data.tags) ? data.tags : [], 
       reminders: Array.isArray(rems) ? rems : []
    });
  };

  const handleAutoGenerate = async () => {
      try {
         if (!messages) return null;
         const history = messages.slice(-15).map(m => ({ role: (m.emisor === 'IA' || m.emisor === 'SAMURAI' ? 'bot' : 'user'), text: m.mensaje }));
         const { data, error } = await supabase.functions.invoke('simulate-samurai', {
            body: { question: "Por favor genera la mejor respuesta corta y persuasiva para continuar esta conversación como un experto humano.", history, customPrompts: null }
         });
         if (error) throw error;
         let text = data.answer as string;
         return text.replace(/<<MEDIA:[^>]+>>/gi, '').trim();
      } catch (e) { return null; }
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

  const handleDeleteLead = async () => {
    const tid = toast.loading("Eliminando prospecto...");
    try {
       await supabase.from('conversaciones').delete().eq('lead_id', activeLead.id);
       await supabase.from('leads').delete().eq('id', activeLead.id);
       toast.success("Prospecto eliminado correctamente.", { id: tid });
       setActiveLead(null);
    } catch (err: any) { toast.error("Error al eliminar: " + err.message, { id: tid }); }
  };

  const allTags = [...globalTags, ...localTags];

  return (
    <Layout>
      <div className="h-[calc(100vh-64px)] -m-4 md:-m-8 flex flex-col overflow-hidden bg-[#050505] border-t border-[#1a1a1a]">
        
        {/* BARRA SUPERIOR CON PAUSA GLOBAL */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a0c] border-b border-[#1a1a1a] shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <MessageCircle className="w-3.5 h-3.5 text-indigo-400" /> Bandeja de Entrada
          </span>
          <GlobalAiToggle />
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* COLUMNA 1: LISTA */}
          <div className={cn("w-full md:w-[340px] flex-shrink-0 border-r border-[#1a1a1a] bg-[#0a0a0c] flex flex-col", activeLead ? "hidden md:flex" : "flex")}>
             <div className="p-4 border-b border-[#1a1a1a] shrink-0">
                 <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <Input placeholder="Buscar nombre, ciudad, tag..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9 bg-[#121214] border-[#222225] text-xs rounded-xl focus-visible:ring-indigo-500/50"/>
                 </div>
             </div>
             <ScrollArea className="flex-1">
                {loadingLeads ? <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-slate-600"/></div>
                : <div className="divide-y divide-[#1a1a1a]">
                      {filteredLeads.map(lead => (
                         <button key={lead.id} onClick={() => setActiveLead(lead)}
                           className={cn("w-full text-left p-4 hover:bg-[#161618] transition-colors flex items-start gap-3 relative", activeLead?.id === lead.id ? "bg-[#161618] border-l-2 border-l-indigo-500" : "")}>
                            <Avatar className="h-10 w-10 border border-[#222225] bg-[#121214]">
                                 <AvatarFallback className="bg-transparent text-indigo-400 font-bold">{String(lead.nombre || 'CL').substring(0,2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                               <div className="flex justify-between items-baseline mb-0.5">
                                  <span className={cn("font-bold truncate text-sm flex-1", activeLead?.id === lead.id ? "text-indigo-400" : "text-slate-200")}>{String(lead.nombre || lead.telefono)}</span>
                                  {lead.ai_paused && (
                                    <span className="text-[8px] font-bold text-red-400 uppercase ml-2 shrink-0">PAUSADA</span>
                                  )}
                               </div>
                               <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                  {lead.ciudad && <span className="flex items-center gap-1 font-bold text-indigo-300"><MapPin className="w-2.5 h-2.5"/>{String(lead.ciudad)}</span>}
                                  {lead.email && <span className="flex items-center gap-1 text-emerald-400"><Mail className="w-2.5 h-2.5"/>OK</span>}
                               </div>
                               {Array.isArray(lead.tags) && lead.tags.length > 0 && (
                                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                     {lead.tags.map((rawTag: any, idx: number) => {
                                        const t = extractTagText(rawTag);
                                        if (!t) return null;
                                        const tagConf = allTags.find(lt => lt.text === t);
                                        return (
                                          <Badge key={`${t}-${idx}`} variant="outline" className="text-[8px] h-4 px-1 font-medium" style={{ backgroundColor: (tagConf?.color || '#1e293b') + '20', color: tagConf?.color || '#94a3b8', borderColor: (tagConf?.color || '#334155') + '50' }}>
                                             <span className="truncate max-w-[80px]">{t}</span>
                                          </Badge>
                                        );
                                     })}
                                  </div>
                               )}
                            </div>
                         </button>
                      ))}
                   </div>}
             </ScrollArea>
          </div>

          {/* COLUMNA 2: CHAT */}
          <div className={cn("flex-1 min-w-0 flex flex-col bg-[#050505] relative", !activeLead ? "hidden md:flex items-center justify-center" : "flex")}>
             {activeLead ? (
                <>
                   <div className="h-16 px-4 bg-[#0a0a0c]/80 backdrop-blur-md border-b border-[#1a1a1a] flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-3">
                         <Button variant="ghost" size="icon" className="md:hidden text-slate-400 -ml-2 shrink-0" onClick={() => setActiveLead(null)}>
                            <ChevronLeft className="w-6 h-6" />
                         </Button>
                         <div className="flex flex-col">
                            <span className="font-bold text-white truncate max-w-[200px]">{String(activeLead.nombre || activeLead.telefono)}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{String(activeLead.telefono)}</span>
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <Button variant="ghost" size="icon" className="xl:hidden text-slate-400" onClick={() => setShowMemoryMobile(!showMemoryMobile)}><Menu className="w-5 h-5" /></Button>
                      </div>
                   </div>

                   <MessageList messages={messages} loading={loadingMessages} />

                   <div className="p-3 bg-[#0a0a0c] border-t border-[#1a1a1a] shrink-0">
                      <AiSuggestions suggestions={suggestions} loading={loadingSuggestions} onSelect={(t) => setDraftMessage(t.replace(/<<MEDIA:[^>]+>>/gi, '').trim())} onRefresh={() => fetchAiSuggestions(activeLead.id, messages)} />
                      <MessageInput 
                          onSendMessage={handleSendMessage} 
                          sending={sending} 
                          isAiPaused={activeLead.ai_paused} 
                          initialValue={draftMessage} 
                          onAutoGenerate={handleAutoGenerate}
                          toolbarAction={
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                   <Button size="sm" variant="outline" className="h-8 text-[10px] bg-[#121214] border-[#222225] text-amber-500 uppercase font-bold tracking-widest rounded-lg hover:bg-[#161618]">
                                      <Zap className="w-3 h-3 mr-1.5" /> Plantillas
                                   </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="bg-[#0a0a0c] border-[#222225] text-white w-64 max-h-[300px] overflow-y-auto">
                                   {Array.isArray(products) && products.length > 0 && <>
                                      <DropdownMenuLabel className="text-[10px] uppercase text-slate-500 font-bold">Catálogo</DropdownMenuLabel>
                                      {products.map(p => (
                                          <DropdownMenuItem key={p.id || p.title} onClick={() => setDraftMessage(`${quickActions.wcBaseUrl}/checkout/?add-to-cart=${p.wc_id}`)} className="cursor-pointer text-xs focus:bg-[#161618] focus:text-white">
                                             <ShoppingCart className="w-3 h-3 mr-2 text-indigo-400 shrink-0" /><span className="truncate">{String(p.title)}</span>
                                          </DropdownMenuItem>
                                      ))}
                                      <DropdownMenuSeparator className="bg-[#222225] my-2"/>
                                   </>}
                                   <DropdownMenuItem onClick={() => setDraftMessage(quickActions.bankInfo)} className="cursor-pointer text-xs focus:bg-[#161618] focus:text-white"><CreditCard className="w-3 h-3 mr-2 text-indigo-400" /> Datos Bancarios</DropdownMenuItem>
                                   
                                   {Array.isArray(globalReplies) && globalReplies.length > 0 && <>
                                      <DropdownMenuSeparator className="bg-[#222225] my-2"/>
                                      <DropdownMenuLabel className="text-[10px] uppercase text-slate-500 font-bold">Plantillas Globales</DropdownMenuLabel>
                                      {globalReplies.map((qr) => (
                                         <DropdownMenuItem key={qr.id || qr.title} onClick={() => setDraftMessage(qr.text)} className="cursor-pointer text-xs focus:bg-[#161618] focus:text-white">
                                            <MessageSquarePlus className="w-3 h-3 mr-2 text-indigo-400 shrink-0" /><span className="truncate">{String(qr.title)}</span>
                                         </DropdownMenuItem>
                                      ))}
                                   </>}

                                   {Array.isArray(localReplies) && localReplies.length > 0 && <>
                                      <DropdownMenuSeparator className="bg-[#222225] my-2"/>
                                      <DropdownMenuLabel className="text-[10px] uppercase text-slate-500 font-bold">Mis Plantillas Privadas</DropdownMenuLabel>
                                      {localReplies.map((qr) => (
                                         <DropdownMenuItem key={qr.id || qr.title} onClick={() => setDraftMessage(qr.text)} className="cursor-pointer text-xs focus:bg-[#161618] focus:text-white">
                                            <MessageSquarePlus className="w-3 h-3 mr-2 text-amber-500 shrink-0" /><span className="truncate">{String(qr.title)}</span>
                                         </DropdownMenuItem>
                                      ))}
                                   </>}
                                </DropdownMenuContent>
                             </DropdownMenu>
                          }
                      />
                   </div>
                </>
             ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 h-full">
                   <MessageCircle className="w-12 h-12 mb-4 opacity-20" />
                   <p className="text-xs uppercase font-bold tracking-widest">Selecciona un chat</p>
                </div>
             )}
          </div>

          {/* COLUMNA 3: FICHA TÁCTICA */}
          {activeLead && (
             <div className={cn("w-full xl:w-[360px] flex-shrink-0 bg-[#0a0a0c] border-l border-[#1a1a1a] flex flex-col absolute xl:relative z-20 h-full transition-transform duration-300", showMemoryMobile ? "translate-x-0" : "translate-x-full xl:translate-x-0")}>
                <div className="xl:hidden p-4 border-b border-[#1a1a1a] flex justify-between items-center bg-[#0a0a0c]">
                   <span className="font-bold text-sm">Ficha Táctica</span>
                   <Button variant="ghost" size="sm" onClick={() => setShowMemoryMobile(false)}><X className="w-4 h-4" /></Button>
                </div>
                <MemoryPanel 
                  currentAnalysis={activeLead} 
                  isEditing={isEditingMemory} 
                  setIsEditing={setIsEditingMemory} 
                  memoryForm={memoryForm} 
                  setMemoryForm={setMemoryForm} 
                  onSave={saveMemory} 
                  saving={sending} 
                  onReset={() => {}} 
                  onToggleFollowup={() => handleSendMessage(activeLead.ai_paused ? '#START' : '#STOP')} 
                  onAnalysisComplete={() => { fetchLeads(false); refetchMessages(); }} 
                  onDeleteLead={handleDeleteLead}
                />
             </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Inbox;