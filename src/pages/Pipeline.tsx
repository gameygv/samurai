import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trello, Loader2, TrendingUp, User, Fingerprint, Image, Target, DollarSign, UserPlus, Mail, ShieldCheck, MapPin, Clock, AlertTriangle, GripVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ChatViewer from '@/components/ChatViewer';
import { CreateLeadDialog } from '@/components/leads/CreateLeadDialog';
import { toast } from 'sonner';

const Pipeline = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);

  const TICKET_PRICE = 1500;

  const columns = [
    { id: 'BAJO', title: '1. DATA HUNTING', icon: Fingerprint, color: 'border-blue-500/50 bg-blue-500/5', desc: 'Faltan Nombre/Ciudad' },
    { id: 'MEDIO', title: '2. SEDUCCIÓN', icon: Image, color: 'border-yellow-500/50 bg-yellow-500/5', desc: 'Enviando Posters' },
    { id: 'ALTO', title: '3. CIERRE ($)', icon: Target, color: 'border-red-500/50 bg-red-500/5', desc: 'Link Enviado' }
  ];

  useEffect(() => {
    fetchLeads();
    const channel = supabase.channel('pipeline-live').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, () => fetchLeads()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    const { data } = await supabase.from('leads').select('*').neq('buying_intent', 'COMPRADO').order('last_message_at', { ascending: false });
    if (data) setLeads(data);
    setLoading(false);
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => { setDraggedLeadId(leadId); e.dataTransfer.effectAllowed = 'move'; };

  const handleDrop = async (e: React.DragEvent, targetIntent: string) => {
     e.preventDefault();
     if (!draggedLeadId) return;
     const leadId = draggedLeadId;
     setLeads(prev => prev.map(l => l.id === leadId ? { ...l, buying_intent: targetIntent } : l));
     setDraggedLeadId(null);
     try {
        await supabase.from('leads').update({ buying_intent: targetIntent }).eq('id', leadId);
        toast.success(`Lead movido a ${targetIntent}`);
     } catch (err) { fetchLeads(); }
  };

  const getLeadsByIntent = (intent: string) => leads.filter(l => (l.buying_intent || 'BAJO').toUpperCase() === intent);
  
  const totalValue = leads.filter(l => l.buying_intent === 'ALTO').length * TICKET_PRICE;
  const capiReadyCount = leads.filter(l => l.email && l.email.length > 5).length;

  return (
    <Layout>
      <div className="max-w-[1800px] mx-auto space-y-6 h-[calc(100vh-140px)] flex flex-col">
        
        {/* HEADER TÁCTICO FINANCIERO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <Card className="bg-slate-900/50 border-slate-800 p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400"><Trello className="w-6 h-6" /></div>
              <div><h3 className="text-xs font-bold text-slate-500 uppercase">Total en Embudo</h3><p className="text-2xl font-bold text-white">{leads.length} Leads</p></div>
           </Card>
           <Card className="bg-slate-900/50 border-slate-800 p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400"><ShieldCheck className="w-6 h-6" /></div>
              <div><h3 className="text-xs font-bold text-slate-500 uppercase">Salud Meta CAPI</h3><p className="text-2xl font-bold text-white">{capiReadyCount} <span className="text-xs text-slate-500 font-normal">Listos</span></p></div>
           </Card>
           <Card className="bg-slate-900/50 border-emerald-500/30 p-4 flex items-center justify-between border-l-4 border-l-emerald-500">
              <div className="flex items-center gap-4">
                 <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400"><DollarSign className="w-6 h-6" /></div>
                 <div><h3 className="text-xs font-bold text-slate-500 uppercase">Potencial Cierre</h3><p className="text-2xl font-bold text-white">${totalValue.toLocaleString()}</p></div>
              </div>
              <Button className="bg-emerald-600 hover:bg-emerald-700 h-10" onClick={() => setIsCreateOpen(true)}><UserPlus className="w-4 h-4 mr-2" /> Nuevo</Button>
           </Card>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-0">
          {columns.map((col) => {
            const leadsInCol = getLeadsByIntent(col.id);
            return (
              <div key={col.id} className={cn("rounded-xl border flex flex-col min-h-0 shadow-2xl overflow-hidden", col.color)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, col.id)}>
                <div className="p-4 border-b border-slate-800/50 bg-slate-900/40 flex justify-between items-center">
                   <div><h3 className="font-bold text-xs text-white uppercase tracking-widest flex items-center gap-2"><col.icon className="w-4 h-4 text-indigo-400" /> {col.title}</h3><p className="text-[9px] text-slate-400 mt-1">{col.desc}</p></div>
                   <Badge className="bg-slate-950 text-indigo-400 border-indigo-500/20">{leadsInCol.length}</Badge>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                  {leadsInCol.map((lead) => (
                    <div key={lead.id} draggable onDragStart={(e) => handleDragStart(e, lead.id)} className="cursor-move">
                       <Card className="bg-slate-900 border-slate-800 hover:border-indigo-500/50 transition-all group relative overflow-hidden" onClick={() => { setSelectedLead(lead); setIsChatOpen(true); }}>
                         <div className={cn("absolute left-0 top-0 bottom-0 w-1", lead.ai_paused ? "bg-red-500" : "bg-emerald-500")} />
                         <CardContent className="p-3 pl-5 space-y-2">
                            <div className="flex justify-between items-start">
                               <div><p className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors truncate max-w-[150px]">{lead.nombre || lead.telefono}</p></div>
                               <GripVertical className="w-3 h-3 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="flex gap-1">
                               {lead.ciudad && <Badge variant="outline" className="text-[8px] h-4 px-1 border-slate-700 text-slate-400"><MapPin className="w-2 h-2 mr-1"/>{lead.ciudad}</Badge>}
                               {lead.email && <Badge variant="outline" className="text-[8px] h-4 px-1 border-emerald-500/30 text-emerald-500"><Mail className="w-2 h-2"/></Badge>}
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