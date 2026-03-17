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
  const { user, isManager } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [agentsMap, setAgentsMap] = useState<Record<string, string>>({});
  const [localTags, setLocalTags] = useState<{id: string, text: string, color: string}[]>([]);
  
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [filterAgent, setFilterAgent] = useState<string>('ALL');

  useEffect(() => {
    fetchLeads();
    if (user) fetchLocalTags();
    supabase.from('profiles').select('id, full_name').then(({data}) => {
       if (data) {
          const map: any = {};
          data.forEach(d => map[d.id] = d.full_name);
          setAgentsMap(map);
       }
    });
  }, [user]);

  const fetchLeads = async () => {
    setLoading(true);
    let query = supabase.from('leads').select('*').order('last_message_at', { ascending: false });
    if (!isManager) query = query.eq('assigned_to', user?.id);
    const { data } = await query;
    if (data) setLeads(data);
    setLoading(false);
  };

  const fetchLocalTags = async () => {
     if(!user) return;
     const { data } = await supabase.from('app_config').select('value').eq('key', `agent_tags_${user.id}`).maybeSingle();
     if (data?.value) { try { setLocalTags(JSON.parse(data.value)); } catch(e) {} }
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => { setDraggedLeadId(leadId); };
  const handleDrop = async (e: React.DragEvent, targetIntent: string) => {
     if (!draggedLeadId) return;
     try {
        await supabase.from('leads').update({ buying_intent: targetIntent }).eq('id', draggedLeadId);
        fetchLeads();
     } catch (err) { toast.error("Error al mover lead."); }
  };

  const columns = [
    { id: 'BAJO', title: 'Data Hunting', icon: Fingerprint, color: 'border-slate-700 bg-slate-800/30' },
    { id: 'MEDIO', title: 'Seducción', icon: Image, color: 'border-indigo-900/50 bg-indigo-900/10' },
    { id: 'ALTO', title: 'Cierre ($)', icon: Target, color: 'border-amber-700/50 bg-amber-900/10' },
    { id: 'COMPRADO', title: 'Ganado', icon: CheckCircle2, color: 'border-emerald-700/50 bg-emerald-900/10' }
  ];

  return (
    <Layout>
      <div className="max-w-[1800px] mx-auto space-y-6 h-[calc(100vh-140px)] flex flex-col">
        <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800">
           <div className="flex items-center gap-4">
              <Trello className="w-6 h-6 text-indigo-400" />
              <h1 className="text-xl font-bold">Embudo de Ventas</h1>
           </div>
           <div className="flex gap-2">
              {isManager && (
                 <Select value={filterAgent} onValueChange={setFilterAgent}>
                    <SelectTrigger className="w-48 bg-slate-950 h-10"><SelectValue placeholder="Asesor" /></SelectTrigger>
                    <SelectContent className="bg-slate-900 text-white">
                       <SelectItem value="ALL">Todo el Equipo</SelectItem>
                       {Object.entries(agentsMap).map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                    </SelectContent>
                 </Select>
              )}
              <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 h-10 rounded-xl"><UserPlus className="w-4 h-4 mr-2" /> Nuevo Lead</Button>
           </div>
        </div>

        <div className="flex-1 flex gap-4 min-h-0 overflow-x-auto pb-4">
          {columns.map((col) => (
              <div key={col.id} className={cn("rounded-2xl border flex flex-col min-h-0 min-w-[300px] w-full shrink-0", col.color)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, col.id)}>
                <div className="p-4 border-b border-slate-800/50 bg-slate-900/60 flex justify-between items-center">
                   <h3 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2"><col.icon className="w-4 h-4" /> {col.title}</h3>
                   <Badge className="bg-slate-950">{leads.filter(l => (l.buying_intent || 'BAJO').toUpperCase() === col.id).length}</Badge>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {leads.filter(l => (l.buying_intent || 'BAJO').toUpperCase() === col.id && (filterAgent === 'ALL' || l.assigned_to === filterAgent)).map((lead) => (
                    <div key={lead.id} draggable onDragStart={(e) => handleDragStart(e, lead.id)} onClick={() => { setSelectedLead(lead); setIsChatOpen(true); }} className="cursor-move">
                       <Card className="bg-slate-900 border-slate-800 hover:border-slate-600 transition-all p-3 space-y-3 shadow-md">
                          <p className="text-xs font-bold text-slate-100 truncate">{lead.nombre || lead.telefono}</p>
                          <div className="flex gap-1.5 flex-wrap">
                               {lead.ciudad && <Badge variant="outline" className="text-[8px] h-4 px-1.5 border-slate-700 text-slate-400"><MapPin className="w-2 h-2 mr-1"/>{lead.ciudad}</Badge>}
                               {isManager && lead.payment_status === 'VALID' && <Badge className="text-[8px] h-4 bg-emerald-900/20 text-emerald-400 border-emerald-500/30"><ShieldCheck className="w-2 h-2 mr-1"/>PAGO OK</Badge>}
                          </div>
                       </Card>
                    </div>
                  ))}
                </div>
              </div>
          ))}
        </div>
        {selectedLead && <ChatViewer lead={selectedLead} open={isChatOpen} onOpenChange={setIsChatOpen} />}
        {isCreateOpen && <CreateLeadDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={fetchLeads} />}
      </div>
    </Layout>
  );
};
export default Pipeline;