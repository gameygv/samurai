import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trello, Loader2, TrendingUp, User, Fingerprint, Image, Target, DollarSign, UserPlus, Mail, ShieldCheck, MapPin, Clock, AlertTriangle
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

  const TICKET_PRICE = 1500;

  const columns = [
    { id: 'BAJO', title: '1. DATA HUNTING', icon: Fingerprint, color: 'border-blue-500/50 bg-blue-500/5', desc: 'Faltan Nombre/Ciudad' },
    { id: 'MEDIO', title: '2. SEDUCCIÓN', icon: Image, color: 'border-yellow-500/50 bg-yellow-500/5', desc: 'Enviando Posters' },
    { id: 'ALTO', title: '3. CIERRE ($)', icon: Target, color: 'border-red-500/50 bg-red-500/5', desc: 'Link Enviado' }
  ];

  useEffect(() => {
    fetchLeads();
    
    const channel = supabase
      .channel('pipeline-live-v5')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (payload) => {
         fetchLeads(); // Refrescamos todo para ordenar
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('leads')
      .select('*')
      .neq('buying_intent', 'COMPRADO')
      .order('last_message_at', { ascending: false });
    
    if (data) setLeads(data);
    setLoading(false);
  };

  const getLeadsByIntent = (intent: string) => leads.filter(l => (l.buying_intent || 'BAJO').toUpperCase() === intent);
  
  // Helper para tiempo relativo
  const getTimeAgo = (dateStr: string | null) => {
     if (!dateStr) return { text: 'N/A', status: 'normal' };
     const diff = new Date().getTime() - new Date(dateStr).getTime();
     const minutes = Math.floor(diff / 60000);
     const hours = Math.floor(diff / 3600000);
     const days = Math.floor(diff / 86400000);

     if (minutes < 60) return { text: `${minutes}m`, status: 'fresh' };
     if (hours < 24) return { text: `${hours}h`, status: 'normal' };
     return { text: `${days}d`, status: 'stale' };
  };

  const totalValue = leads.filter(l => l.buying_intent === 'ALTO').length * TICKET_PRICE;
  const capiReadyCount = leads.filter(l => l.email && l.email.length > 5).length;

  return (
    <Layout>
      <div className="max-w-[1800px] mx-auto space-y-6 h-[calc(100vh-140px)] flex flex-col">
        
        {/* HEADER TÁCTICO */}
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
              <div key={col.id} className={cn("rounded-xl border flex flex-col min-h-0 shadow-2xl overflow-hidden", col.color)}>
                <div className="p-4 border-b border-slate-800/50 bg-slate-900/40 flex justify-between items-center">
                   <div>
                      <h3 className="font-bold text-xs text-white uppercase tracking-widest flex items-center gap-2">
                         <col.icon className="w-4 h-4 text-indigo-400" /> {col.title}
                      </h3>
                      <p className="text-[9px] text-slate-400 mt-1">{col.desc}</p>
                   </div>
                   <Badge className="bg-slate-950 text-indigo-400 border-indigo-500/20">{leadsInCol.length}</Badge>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-slate-950/20">
                  {leadsInCol.map((lead) => {
                    const timeAgo = getTimeAgo(lead.last_message_at);
                    return (
                    <Card key={lead.id} className={cn("bg-slate-900 border-slate-800 hover:border-indigo-500/50 transition-all cursor-pointer group relative overflow-hidden", timeAgo.status === 'stale' && "opacity-80")} onClick={() => { setSelectedLead(lead); setIsChatOpen(true); }}>
                      <div className={cn("absolute left-0 top-0 bottom-0 w-1", lead.ai_paused ? "bg-red-500" : (timeAgo.status === 'stale' ? 'bg-yellow-600' : 'bg-emerald-500'))} />
                      <CardContent className="p-3 pl-5 space-y-2">
                         <div className="flex justify-between items-start">
                            <div>
                               <p className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors truncate max-w-[150px]">{lead.nombre || lead.telefono}</p>
                               <div className="flex gap-1 mt-1">
                                  {lead.ciudad && <Badge variant="outline" className="text-[8px] h-4 px-1 border-slate-700 text-slate-400"><MapPin className="w-2 h-2 mr-1"/>{lead.ciudad}</Badge>}
                                  {lead.email && <Badge variant="outline" className="text-[8px] h-4 px-1 border-emerald-500/30 text-emerald-500"><Mail className="w-2 h-2"/></Badge>}
                               </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                               {lead.ai_paused && <Badge variant="destructive" className="h-4 px-1 text-[8px] bg-red-600">STOP</Badge>}
                               {timeAgo.status === 'stale' && <AlertTriangle className="w-3 h-3 text-yellow-600" />}
                            </div>
                         </div>
                         <div className="flex items-center justify-between pt-2 border-t border-slate-800/50 text-[8px] text-slate-500">
                            <span className="font-bold uppercase tracking-wider">Fase: {lead.followup_stage}</span>
                            <span className={cn("font-mono flex items-center gap-1", timeAgo.status === 'fresh' ? "text-green-400" : (timeAgo.status === 'stale' ? "text-red-400" : "text-slate-500"))}>
                               <Clock className="w-2.5 h-2.5" /> {timeAgo.text}
                            </span>
                         </div>
                      </CardContent>
                    </Card>
                  )})}
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