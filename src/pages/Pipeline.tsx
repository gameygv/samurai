import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trello, Loader2, User, Fingerprint, Image, Target, DollarSign, UserPlus, Mail, ShieldCheck, MapPin, AlertTriangle, GripVertical
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
    { id: 'BAJO', title: '1. DATA HUNTING', icon: Fingerprint, color: 'border-slate-700 bg-slate-800/30', desc: 'Faltan Nombre/Ciudad' },
    { id: 'MEDIO', title: '2. SEDUCCIÓN', icon: Image, color: 'border-indigo-900/50 bg-indigo-900/10', desc: 'Enviando Posters' },
    { id: 'ALTO', title: '3. CIERRE ($)', icon: Target, color: 'border-amber-700/50 bg-amber-900/10', desc: 'Link Enviado' }
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
           <Card className="bg-slate-900 border-slate-800 p-4 flex items-center gap-4 rounded-2xl shadow-lg">
              <div className="p-3 rounded-xl bg-slate-800 text-slate-300"><Trello className="w-6 h-6" /></div>
              <div><h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total en Embudo</h3><p className="text-2xl font-bold text-slate-50">{leads.length} Leads</p></div>
           </Card>
           <Card className="bg-slate-900 border-slate-800 p-4 flex items-center gap-4 rounded-2xl shadow-lg">
              <div className="p-3 rounded-xl bg-indigo-900/30 text-indigo-300 border border-indigo-900/50"><ShieldCheck className="w-6 h-6" /></div>
              <div><h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Salud Meta CAPI</h3><p className="text-2xl font-bold text-slate-50">{capiReadyCount} <span className="text-xs text-slate-500 font-normal">Listos</span></p></div>
           </Card>
           <Card className="bg-slate-900 border-amber-600/30 p-4 flex items-center justify-between border-l-4 border-l-amber-500 rounded-2xl shadow-xl">
              <div className="flex items-center gap-4">
                 <div className="p-3 rounded-xl bg-amber-900/30 text-amber-500"><DollarSign className="w-6 h-6" /></div>
                 <div><h3 className="text-xs font-bold text-amber-600/80 uppercase tracking-widest">Potencial Cierre</h3><p className="text-2xl font-bold text-slate-50">${totalValue.toLocaleString()}</p></div>
              </div>
              <Button className="bg-indigo-900 hover:bg-indigo-800 text-slate-50 h-11 px-5 rounded-xl shadow-lg" onClick={() => setIsCreateOpen(true)}><UserPlus className="w-4 h-4 mr-2" /> Nuevo</Button>
           </Card>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-0">
          {columns.map((col) => {
            const leadsInCol = getLeadsByIntent(col.id);
            return (
              <div key={col.id} className={cn("rounded-2xl border flex flex-col min-h-0 shadow-2xl overflow-hidden", col.color)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, col.id)}>
                <div className="p-4 border-b border-slate-800/50 bg-slate-900/60 flex justify-between items-center backdrop-blur-sm">
                   <div><h3 className="font-bold text-xs text-slate-200 uppercase tracking-widest flex items-center gap-2"><col.icon className="w-4 h-4 text-slate-400" /> {col.title}</h3><p className="text-[9px] text-slate-500 mt-1">{col.desc}</p></div>
                   <Badge className="bg-slate-950 text-slate-300 border-slate-700 shadow-inner">{leadsInCol.length}</Badge>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-slate-950/20">
                  {leadsInCol.map((lead) => (
                    <div key={lead.id} draggable onDragStart={(e) => handleDragStart(e, lead.id)} className="cursor-move" onClick={() => { setSelectedLead(lead); setIsChatOpen(true); }}>
                       <Card className="bg-slate-900 border-slate-800 hover:border-slate-600 transition-all group relative overflow-hidden shadow-md cursor-pointer">
                         <div className={cn("absolute left-0 top-0 bottom-0 w-1", lead.ai_paused ? "bg-red-900" : "bg-amber-600")} />
                         <CardContent className="p-3 pl-5 space-y-3">
                            <div className="flex justify-between items-start">
                               <div><p className="text-xs font-bold text-slate-100 group-hover:text-amber-400 transition-colors truncate max-w-[150px]">{lead.nombre || lead.telefono}</p></div>
                               <GripVertical className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="flex gap-1.5 flex-wrap mt-1">
                               {lead.ciudad && <Badge variant="outline" className="text-[8px] h-4 px-1.5 border-slate-700 text-slate-400 font-medium"><MapPin className="w-2 h-2 mr-1"/>{lead.ciudad}</Badge>}
                               {lead.email && <Badge variant="outline" className="text-[8px] h-4 px-1.5 border-indigo-900/50 text-indigo-300 font-medium"><Mail className="w-2 h-2 mr-1"/> OK</Badge>}
                               
                               {/* Etiquetas de Ojo de Halcón (Validación de Comprobantes) */}
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