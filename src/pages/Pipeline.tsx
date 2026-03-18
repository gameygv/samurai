import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Trello, Loader2, Fingerprint, Image, Target, DollarSign, UserPlus, 
  MapPin, CheckCircle2, Bot, Clock, AlertTriangle, MessageCircle, Wallet, CalendarDays
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ChatViewer from '@/components/ChatViewer';
import { CreateLeadDialog } from '@/components/leads/CreateLeadDialog';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const Pipeline = () => {
  const { user, isManager } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [agentsMap, setAgentsMap] = useState<Record<string, string>>({});
  const [globalTags, setGlobalTags] = useState<{id: string, text: string, color: string}[]>([]);
  const [localTags, setLocalTags] = useState<{id: string, text: string, color: string}[]>([]);
  
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [filterAgent, setFilterAgent] = useState<string>('ALL');

  useEffect(() => {
    fetchLeads();
    if (user) fetchTags();
    supabase.from('profiles').select('id, full_name').then(({data}) => {
       if (data) {
          const map: any = {};
          data.forEach(d => map[d.id] = d.full_name);
          setAgentsMap(map);
       }
    });

    const channel = supabase.channel('pipeline-live').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchLeads()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchLeads = async () => {
    setLoading(true);
    let query = supabase.from('leads').select('*').order('last_message_at', { ascending: false });
    if (!isManager) query = query.eq('assigned_to', user?.id);
    const { data } = await query;
    if (data) setLeads(data);
    setLoading(false);
  };

  const fetchTags = async () => {
     if(!user) return;
     const { data } = await supabase.from('app_config').select('key, value').in('key', [`agent_tags_${user.id}`, 'global_tags']);
     if (data) {
        const local = data.find(d => d.key === `agent_tags_${user.id}`)?.value;
        const global = data.find(d => d.key === 'global_tags')?.value;
        if (local) try { setLocalTags(JSON.parse(local)); } catch(e) {}
        if (global) try { setGlobalTags(JSON.parse(global)); } catch(e) {}
     }
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => { setDraggedLeadId(leadId); };
  const handleDrop = async (e: React.DragEvent, targetIntent: string) => {
     if (!draggedLeadId) return;
     const tid = toast.loading("Actualizando etapa...");
     try {
        await supabase.from('leads').update({ buying_intent: targetIntent }).eq('id', draggedLeadId);
        toast.success("Lead movido.", { id: tid });
        fetchLeads();
     } catch (err) { toast.error("Error al mover lead.", { id: tid }); }
  };

  const getTimeAgo = (dateStr: string) => {
      try {
          return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es });
      } catch(e) { return 'recientemente'; }
  };

  const handleOpenChat = (lead: any) => {
    setSelectedLead(lead);
    setIsChatOpen(true);
  };

  const columns = [
    { id: 'BAJO', title: 'Data Hunting', icon: Fingerprint, color: 'border-slate-800', headerBg: 'bg-[#161618]', dot: 'bg-slate-500' },
    { id: 'MEDIO', title: 'Seducción', icon: Image, color: 'border-indigo-900/30', headerBg: 'bg-indigo-950/20', dot: 'bg-indigo-500' },
    { id: 'ALTO', title: 'Cierre ($)', icon: Target, color: 'border-amber-900/30', headerBg: 'bg-amber-950/20', dot: 'bg-amber-500' },
    { id: 'COMPRADO', title: 'Ganado', icon: CheckCircle2, color: 'border-emerald-900/30', headerBg: 'bg-emerald-950/20', dot: 'bg-emerald-500' }
  ];

  const allTags = [...globalTags, ...localTags];

  return (
    <Layout>
      <div className="max-w-[1800px] mx-auto space-y-6 h-[calc(100vh-140px)] flex flex-col">
        <div className="flex justify-between items-center bg-[#0a0a0c] p-5 rounded-3xl border border-[#1a1a1a] shadow-2xl">
           <div className="flex items-center gap-4">
              <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                 <Trello className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                 <h1 className="text-xl font-bold text-white">Embudo de Ventas (Pipeline)</h1>
                 <p className="text-xs text-slate-500 mt-0.5">Arrastra las tarjetas para cambiar su etapa de maduración.</p>
              </div>
           </div>
           <div className="flex gap-3">
              {isManager && (
                 <Select value={filterAgent} onValueChange={setFilterAgent}>
                    <SelectTrigger className="w-56 bg-[#121214] border-[#222225] h-11 rounded-xl text-sm font-bold text-slate-300">
                       <SelectValue placeholder="Asesor" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0f0f11] border-[#222225] text-white rounded-xl">
                       <SelectItem value="ALL">Todo el Equipo</SelectItem>
                       {Object.entries(agentsMap).map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                    </SelectContent>
                 </Select>
              )}
              <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 px-6 rounded-xl shadow-lg uppercase tracking-widest text-xs">
                 <UserPlus className="w-4 h-4 mr-2" /> Nuevo Lead
              </Button>
           </div>
        </div>

        <div className="flex-1 flex gap-5 min-h-0 overflow-x-auto pb-4 custom-scrollbar">
          {columns.map((col) => {
              const colLeads = leads.filter(l => (l.buying_intent || 'BAJO').toUpperCase() === col.id && (filterAgent === 'ALL' || l.assigned_to === filterAgent));
              return (
              <div key={col.id} className={cn("rounded-3xl border flex flex-col min-h-0 min-w-[340px] w-[340px] shrink-0 bg-[#0a0a0c]/80 backdrop-blur-sm shadow-xl", col.color)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, col.id)}>
                <div className={cn("p-4 border-b border-[#1a1a1a] flex justify-between items-center rounded-t-3xl", col.headerBg)}>
                   <h3 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2 text-slate-200">
                      <div className={cn("w-2 h-2 rounded-full shadow-lg", col.dot)} />
                      {col.title}
                   </h3>
                   <Badge className="bg-[#121214] text-slate-300 border-[#222225] shadow-inner font-mono">{colLeads.length}</Badge>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                  {colLeads.map((lead) => {
                     const isStale = new Date().getTime() - new Date(lead.last_message_at).getTime() > 24 * 60 * 60 * 1000;
                     const score = lead.lead_score || 0;
                     
                     return (
                     <div key={lead.id} draggable onDragStart={(e) => handleDragStart(e, lead.id)} onClick={() => handleOpenChat(lead)} className="cursor-pointer group">
                        <Card className="bg-[#121214] border-[#222225] hover:border-indigo-500/50 transition-all p-4 space-y-4 shadow-lg group-hover:shadow-indigo-500/10 rounded-2xl relative overflow-hidden">
                           
                           <div className={cn("absolute left-0 top-0 bottom-0 w-1 opacity-50 group-hover:opacity-100 transition-opacity", col.dot)} />

                           <div className="flex justify-between items-start pl-2">
                              <div className="flex-1 min-w-0 pr-2">
                                 <p className="text-sm font-bold text-slate-100 truncate group-hover:text-indigo-300 transition-colors">{lead.nombre || lead.telefono}</p>
                                 <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-[#7A8A9E] font-mono">{lead.telefono}</span>
                                    {lead.ciudad && <span className="flex items-center text-[9px] text-slate-500 truncate max-w-[100px]"><MapPin className="w-2.5 h-2.5 mr-0.5"/>{lead.ciudad}</span>}
                                 </div>
                              </div>
                              <Avatar className="w-8 h-8 rounded-lg border border-[#222225] bg-[#0a0a0c] shrink-0">
                                 <AvatarFallback className="text-[10px] text-slate-500 font-bold">
                                    {agentsMap[lead.assigned_to]?.substring(0,2).toUpperCase() || 'BOT'}
                                 </AvatarFallback>
                              </Avatar>
                           </div>

                           <div className="pl-2 space-y-1.5">
                               <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest text-[#7A8A9E]">
                                   <span>IA Score</span>
                                   <span>{score} / 100</span>
                               </div>
                               <div className="w-full h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                                   <div className={cn("h-full", score > 70 ? 'bg-emerald-500' : score > 40 ? 'bg-amber-500' : 'bg-indigo-500')} style={{ width: `${score}%` }} />
                               </div>
                           </div>

                           {Array.isArray(lead.tags) && lead.tags.length > 0 && (
                               <div className="pl-2 flex gap-1.5 flex-wrap">
                                   {lead.tags.slice(0,3).map((t: string) => {
                                       const tagConf = allTags.find(lt => lt.text === t);
                                       const bgColor = tagConf ? tagConf.color + '15' : '#1e293b';
                                       const textColor = tagConf ? tagConf.color : '#94a3b8';
                                       const borderColor = tagConf ? tagConf.color + '40' : '#334155';
                                       return <Badge key={t} style={{ backgroundColor: bgColor, color: textColor, borderColor }} className="text-[8px] h-4 px-1.5 font-bold uppercase border tracking-widest truncate max-w-[80px]">{t}</Badge>
                                   })}
                                   {lead.tags.length > 3 && <Badge variant="outline" className="text-[8px] h-4 px-1 border-[#222225] text-slate-500">+{lead.tags.length - 3}</Badge>}
                               </div>
                           )}

                           <div className="pl-2 pt-3 border-t border-[#1a1a1a] flex justify-between items-center text-[10px]">
                              <div className="flex items-center gap-2">
                                  {lead.ai_paused ? (
                                      <Badge variant="outline" className="bg-[#3d0f0f]/30 border-[#5e1616] text-red-400 text-[8px] h-4 font-bold uppercase">PAUSADO</Badge>
                                  ) : (
                                      <Bot className="w-3.5 h-3.5 text-emerald-500" />
                                  )}
                                  {lead.payment_status === 'VALID' && <Wallet className="w-3.5 h-3.5 text-amber-500" />}
                              </div>
                              <span className={cn("flex items-center gap-1 font-mono", isStale ? "text-amber-500" : "text-[#7A8A9E]")}>
                                 {isStale && <AlertTriangle className="w-2.5 h-2.5" />} {getTimeAgo(lead.last_message_at)}
                              </span>
                           </div>
                        </Card>
                     </div>
                  )})}
                </div>
              </div>
          )})}
        </div>
        
        {selectedLead && <ChatViewer lead={selectedLead} open={isChatOpen} onOpenChange={setIsChatOpen} />}
        {isCreateOpen && <CreateLeadDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={fetchLeads} />}
      </div>
    </Layout>
  );
};
export default Pipeline;