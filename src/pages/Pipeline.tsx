import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Trello, Loader2, Fingerprint, Image, Target, DollarSign, UserPlus, 
  Mail, ShieldCheck, MapPin, AlertTriangle, GripVertical, CheckCircle2, XCircle, Bot, Play, Pause, User, Tag
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import ChatViewer from '@/components/ChatViewer';
import { CreateLeadDialog } from '@/components/leads/CreateLeadDialog';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

const Pipeline = () => {
  const { user, isAdmin } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [agentsMap, setAgentsMap] = useState<Record<string, string>>({});
  
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [filterAgent, setFilterAgent] = useState<string>('ALL');

  const TICKET_PRICE = 1500;

  const columns = [
    { id: 'BAJO', title: '1. DATA HUNTING', icon: Fingerprint, color: 'border-slate-700 bg-slate-800/30', desc: 'Faltan Nombre/Ciudad' },
    { id: 'MEDIO', title: '2. SEDUCCIÓN', icon: Image, color: 'border-indigo-900/50 bg-indigo-900/10', desc: 'Enviando Info/Posters' },
    { id: 'ALTO', title: '3. CIERRE ($)', icon: Target, color: 'border-amber-700/50 bg-amber-900/10', desc: 'Link de Pago Enviado' },
    { id: 'COMPRADO', title: '4. GANADO', icon: CheckCircle2, color: 'border-emerald-700/50 bg-emerald-900/10', desc: 'Pago Confirmado' },
    { id: 'PERDIDO', title: '5. PERDIDO', icon: XCircle, color: 'border-red-900/50 bg-red-900/10', desc: 'Lead abandonado/frío' }
  ];

  useEffect(() => {
    fetchLeads();
    supabase.from('profiles').select('id, full_name, role').in('role', ['admin', 'dev', 'sales']).then(({data}) => {
       if (data) {
          const map: any = {};
          data.forEach(d => map[d.id] = d.full_name);
          setAgentsMap(map);
       }
    });

    const channel = supabase.channel('pipeline-live').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, () => fetchLeads()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    let query = supabase.from('leads').select('*').order('last_message_at', { ascending: false });
    if (!isAdmin) {
       query = query.eq('assigned_to', user?.id);
    }
    const { data } = await query;
    if (data) setLeads(data);
    setLoading(false);
  };

  const handleGlobalAiToggle = async (pause: boolean) => {
    if (!confirm(`¿Seguro que quieres ${pause ? 'PAUSAR' : 'ACTIVAR'} la IA exclusivamente para TODOS TUS chats asignados?`)) return;
    
    const { error } = await supabase.from('leads').update({ ai_paused: pause }).eq('assigned_to', user?.id);
    
    if (error) {
       toast.error("Error ejecutando acción masiva.");
    } else {
       toast.success(`IA ${pause ? 'Pausada' : 'Activada'} masivamente en tus chats.`);
       fetchLeads();
    }
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => { 
     setDraggedLeadId(leadId); 
     e.dataTransfer.effectAllowed = 'move'; 
  };

  const handleDrop = async (e: React.DragEvent, targetIntent: string) => {
     e.preventDefault();
     if (!draggedLeadId) return;
     const leadId = draggedLeadId;
     
     setLeads(prev => prev.map(l => l.id === leadId ? { ...l, buying_intent: targetIntent } : l));
     setDraggedLeadId(null);
     
     try {
        const { error } = await supabase.from('leads').update({ buying_intent: targetIntent }).eq('id', leadId);
        if (error) throw error;
        toast.success(`Lead movido a la etapa: ${targetIntent}`);
     } catch (err) { 
        toast.error("Error al mover el lead.");
        fetchLeads();
     }
  };

  const getLeadsByIntent = (intent: string) => {
     return leads.filter(l => {
        const matchesIntent = (l.buying_intent || 'BAJO').toUpperCase() === intent;
        const matchesAgent = filterAgent === 'ALL' || l.assigned_to === filterAgent || (filterAgent === 'UNASSIGNED' && !l.assigned_to);
        return matchesIntent && matchesAgent;
     });
  };
  
  const visibleLeads = leads.filter(l => filterAgent === 'ALL' || l.assigned_to === filterAgent || (filterAgent === 'UNASSIGNED' && !l.assigned_to));
  const totalPotential = visibleLeads.filter(l => l.buying_intent === 'ALTO').length * TICKET_PRICE;
  const totalWon = visibleLeads.filter(l => l.buying_intent === 'COMPRADO').length * TICKET_PRICE;
  const capiReadyCount = visibleLeads.filter(l => l.email && l.email.length > 5).length;

  return (
    <Layout>
      <div className="max-w-[1800px] mx-auto space-y-6 h-[calc(100vh-140px)] flex flex-col">
        
        {/* TOP STATS */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
           <Card className="bg-slate-900 border-slate-800 p-4 flex items-center gap-4 rounded-2xl shadow-lg">
              <div className="p-3 rounded-xl bg-slate-800 text-slate-300"><Trello className="w-6 h-6" /></div>
              <div><h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Embudo</h3><p className="text-xl font-bold text-slate-50">{visibleLeads.length}</p></div>
           </Card>
           <Card className="bg-slate-900 border-slate-800 p-4 flex items-center gap-4 rounded-2xl shadow-lg">
              <div className="p-3 rounded-xl bg-indigo-900/30 text-indigo-300 border border-indigo-900/50"><ShieldCheck className="w-6 h-6" /></div>
              <div><h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Listos CAPI</h3><p className="text-xl font-bold text-slate-50">{capiReadyCount}</p></div>
           </Card>
           <Card className="bg-slate-900 border-slate-800 p-4 flex items-center gap-4 rounded-2xl shadow-lg">
              <div className="p-3 rounded-xl bg-amber-900/30 text-amber-500 border border-amber-900/50"><Target className="w-6 h-6" /></div>
              <div><h3 className="text-xs font-bold text-amber-600/80 uppercase tracking-widest">Potencial</h3><p className="text-xl font-bold text-slate-50">${totalPotential.toLocaleString()}</p></div>
           </Card>
           <Card className="bg-slate-900 border-emerald-600/30 p-4 flex items-center gap-4 border-l-4 border-l-emerald-500 rounded-2xl shadow-xl">
              <div className="p-3 rounded-xl bg-emerald-900/30 text-emerald-500"><DollarSign className="w-6 h-6" /></div>
              <div><h3 className="text-xs font-bold text-emerald-600/80 uppercase tracking-widest">Ganados</h3><p className="text-xl font-bold text-slate-50">${totalWon.toLocaleString()}</p></div>
           </Card>
           <Card className="bg-transparent border-0 p-0 flex flex-col justify-center gap-2 shadow-none">
              {isAdmin && (
                 <Select value={filterAgent} onValueChange={setFilterAgent}>
                    <SelectTrigger className="w-full bg-slate-900 border-slate-800 h-10 rounded-xl">
                       <SelectValue placeholder="Filtro de Vendedores" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                       <SelectItem value="ALL">Equipo Completo</SelectItem>
                       <SelectItem value="UNASSIGNED">Bot Global (Sin Asignar)</SelectItem>
                       {Object.entries(agentsMap).map(([id, name]) => (
                          <SelectItem key={id} value={id}>{name}</SelectItem>
                       ))}
                    </SelectContent>
                 </Select>
              )}
              <div className="flex gap-2">
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                       <Button variant="outline" className="flex-1 border-slate-700 text-slate-300 bg-slate-900 hover:bg-slate-800 h-10 rounded-xl px-2">
                          <Bot className="w-4 h-4 mr-2 text-indigo-400"/> IA de Mis Chats
                       </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-slate-900 border-slate-800 text-white">
                       <DropdownMenuLabel className="text-[10px] text-slate-500 uppercase">Control de Cartera Personal</DropdownMenuLabel>
                       <DropdownMenuSeparator className="bg-slate-800" />
                       <DropdownMenuItem onClick={() => handleGlobalAiToggle(false)} className="text-emerald-400 focus:bg-emerald-900/20 focus:text-emerald-300 cursor-pointer">
                          <Play className="w-4 h-4 mr-2"/> Activar a Todos
                       </DropdownMenuItem>
                       <DropdownMenuItem onClick={() => handleGlobalAiToggle(true)} className="text-red-400 focus:bg-red-900/20 focus:text-red-300 cursor-pointer">
                          <Pause className="w-4 h-4 mr-2"/> Pausar a Todos
                       </DropdownMenuItem>
                    </DropdownMenuContent>
                 </DropdownMenu>
                 <Button className="bg-indigo-900 hover:bg-indigo-800 text-slate-50 h-10 w-10 p-0 rounded-xl shadow-lg shrink-0" onClick={() => setIsCreateOpen(true)} title="Nuevo Lead"><UserPlus className="w-4 h-4" /></Button>
              </div>
           </Card>
        </div>

        {/* PIPELINE BOARD */}
        <div className="flex-1 flex gap-4 min-h-0 overflow-x-auto custom-scrollbar pb-4">
          {columns.map((col) => {
            const leadsInCol = getLeadsByIntent(col.id);
            return (
              <div key={col.id} className={cn("rounded-2xl border flex flex-col min-h-0 shadow-2xl overflow-hidden min-w-[280px] w-full max-w-[350px] shrink-0", col.color)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, col.id)}>
                <div className="p-4 border-b border-slate-800/50 bg-slate-900/60 flex justify-between items-center backdrop-blur-sm shrink-0">
                   <div>
                      <h3 className="font-bold text-xs text-slate-200 uppercase tracking-widest flex items-center gap-2"><col.icon className="w-4 h-4 text-slate-400" /> {col.title}</h3>
                      <p className="text-[9px] text-slate-500 mt-1">{col.desc}</p>
                   </div>
                   <Badge className="bg-slate-950 text-slate-300 border-slate-700 shadow-inner">{leadsInCol.length}</Badge>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-slate-950/20">
                  {loading ? (
                     <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-600" /></div>
                  ) : leadsInCol.map((lead) => (
                    <div key={lead.id} draggable onDragStart={(e) => handleDragStart(e, lead.id)} className="cursor-move" onClick={() => { setSelectedLead(lead); setIsChatOpen(true); }}>
                       <Card className="bg-slate-900 border-slate-800 hover:border-slate-600 transition-all group relative overflow-hidden shadow-md cursor-pointer">
                         <div className={cn("absolute left-0 top-0 bottom-0 w-1", lead.ai_paused ? "bg-red-900" : "bg-amber-600")} />
                         <CardContent className="p-3 pl-5 space-y-3">
                            <div className="flex justify-between items-start">
                               <div>
                                  <p className="text-xs font-bold text-slate-100 group-hover:text-amber-400 transition-colors truncate max-w-[180px]">{lead.nombre || lead.telefono}</p>
                                  {lead.assigned_to && agentsMap[lead.assigned_to] && isAdmin && filterAgent === 'ALL' && (
                                     <Badge variant="outline" className="mt-1 text-[8px] h-4 px-1.5 border-purple-900/50 text-purple-300 font-medium">
                                        <User className="w-2 h-2 mr-1"/> {agentsMap[lead.assigned_to].split(' ')[0]}
                                     </Badge>
                                  )}
                               </div>
                               <GripVertical className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </div>

                            <div className="flex gap-1.5 flex-wrap mt-1">
                               {lead.tags?.map((t: string) => (
                                 <Badge key={t} variant="outline" className="text-[8px] h-4 px-1.5 border-amber-900/50 bg-amber-900/10 text-amber-500 font-medium"><Tag className="w-2 h-2 mr-1"/>{t}</Badge>
                               ))}
                            </div>

                            <div className="flex gap-1.5 flex-wrap mt-1">
                               {lead.ciudad && <Badge variant="outline" className="text-[8px] h-4 px-1.5 border-slate-700 text-slate-400 font-medium"><MapPin className="w-2 h-2 mr-1"/>{lead.ciudad}</Badge>}
                               {lead.email && <Badge variant="outline" className="text-[8px] h-4 px-1.5 border-indigo-900/50 text-indigo-300 font-medium"><Mail className="w-2 h-2 mr-1"/> OK</Badge>}
                               
                               {lead.payment_status === 'VALID' && <Badge variant="outline" className="text-[8px] h-4 px-1.5 border-emerald-900/50 bg-emerald-900/20 text-emerald-400 font-bold"><ShieldCheck className="w-2 h-2 mr-1"/>PAGO VÁLIDO</Badge>}
                               {lead.payment_status === 'INVALID' && <Badge variant="outline" className="text-[8px] h-4 px-1.5 border-red-900/50 bg-red-900/20 text-red-400 font-bold"><AlertTriangle className="w-2 h-2 mr-1"/>PAGO RECHAZADO</Badge>}
                               {lead.payment_status === 'DOUBTFUL' && <Badge variant="outline" className="text-[8px] h-4 px-1.5 border-amber-900/50 bg-amber-900/20 text-amber-400 font-bold"><AlertTriangle className="w-2 h-2 mr-1"/>PAGO DUDOSO</Badge>}
                            </div>
                         </CardContent>
                       </Card>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        
        {selectedLead && <ChatViewer lead={selectedLead} open={isChatOpen} onOpenChange={setIsChatOpen} />}
        {isCreateOpen && <CreateLeadDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={fetchLeads} />}
      </div>
    </Layout>
  );
};

export default Pipeline;