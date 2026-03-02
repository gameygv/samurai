import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trello, Loader2, Clock, TrendingUp, User, Smile, Meh, Frown, Fingerprint, Image, Target, AlertCircle, DollarSign, UserPlus, MailWarning
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ChatViewer from '@/components/ChatViewer';
import { CreateLeadDialog } from '@/components/leads/CreateLeadDialog';

const Pipeline = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const TICKET_PRICE = 1500;

  const columns = [
    { id: 'BAJO', title: '1. CONEXIÓN', icon: Fingerprint, color: 'border-blue-500/50 bg-blue-500/5', desc: 'Datos Incompletos' },
    { id: 'MEDIO', title: '2. SEDUCCIÓN', icon: Image, color: 'border-yellow-500/50 bg-yellow-500/5', desc: 'Interés Validado' },
    { id: 'ALTO', title: '3. CIERRE ($)', icon: Target, color: 'border-red-500/50 bg-red-500/5', desc: 'Link Enviado' }
  ];

  useEffect(() => {
    fetchLeads();
    
    const channel = supabase
      .channel('pipeline-live-v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchLeads())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('leads')
      .select('*')
      .neq('buying_intent', 'COMPRADO') // No mostrar ya vendidos
      .order('last_message_at', { ascending: false });
    
    if (data) setLeads(data);
    setLoading(false);
  };

  const getLeadsByIntent = (intent: string) => {
    return leads.filter(l => (l.buying_intent || 'BAJO').toUpperCase() === intent);
  };

  const isStale = (lastDate: string | null) => {
    if (!lastDate) return false;
    const diff = new Date().getTime() - new Date(lastDate).getTime();
    return diff > (48 * 60 * 60 * 1000); // 48 horas
  };

  const handleOpenChat = (lead: any) => {
    setSelectedLead(lead);
    setIsChatOpen(true);
  };

  const totalValue = leads.filter(l => l.buying_intent === 'ALTO').length * TICKET_PRICE;

  return (
    <Layout>
      <div className="max-w-[1800px] mx-auto space-y-6 h-[calc(100vh-140px)] flex flex-col">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Trello className="w-8 h-8 text-indigo-500" />
              Tablero Táctico
            </h1>
            <p className="text-slate-400">Gestión visual del flujo de ventas.</p>
          </div>
          <div className="flex items-center gap-4">
             <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setIsCreateOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" /> Nuevo
             </Button>
             
             <div className="bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-lg text-right hidden md:block">
                <p className="text-[10px] text-emerald-400 uppercase font-bold tracking-widest">En Cierre (Hot)</p>
                <p className="text-xl font-bold text-white">${totalValue.toLocaleString()} MXN</p>
             </div>
             
             <Button variant="outline" size="icon" className="border-slate-800 text-slate-400" onClick={fetchLeads}>
                <Clock className="w-4 h-4" />
             </Button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-0">
          {columns.map((col) => {
            const ColumnIcon = col.icon;
            const leadsInCol = getLeadsByIntent(col.id);
            const colValue = leadsInCol.length * TICKET_PRICE;
            
            return (
              <div key={col.id} className={cn("rounded-xl border flex flex-col min-h-0 shadow-2xl", col.color)}>
                <div className="p-4 border-b border-slate-800/50 flex flex-col gap-1 bg-slate-900/40 rounded-t-xl">
                  <div className="flex justify-between items-center">
                     <h3 className="font-bold text-xs text-white uppercase tracking-widest flex items-center gap-2">
                        <ColumnIcon className="w-4 h-4 text-indigo-400" />
                        {col.title}
                     </h3>
                     <Badge className="bg-slate-950 text-indigo-400 border-indigo-500/20">{leadsInCol.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                     <p className="text-[10px] text-slate-500 font-mono italic">{col.desc}</p>
                     <span className="text-[10px] font-bold text-slate-400">${colValue.toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                  {leadsInCol.length === 0 ? (
                     <div className="h-32 flex flex-col items-center justify-center text-[10px] text-slate-700 italic uppercase gap-2 border border-dashed border-slate-800 rounded-xl">
                        <TrendingUp className="w-6 h-6 opacity-10" />
                        Sin prospectos
                     </div>
                  ) : leadsInCol.map((lead) => {
                    const stale = isStale(lead.last_message_at);
                    const missingEmail = !lead.email || lead.email.length < 5;
                    
                    return (
                      <Card 
                        key={lead.id} 
                        className={cn(
                           "bg-slate-900 border-slate-800 hover:border-indigo-500/50 transition-all cursor-pointer group relative overflow-hidden",
                           stale && col.id === 'ALTO' && "border-red-600/50 shadow-[0_0_15px_rgba(220,38,38,0.1)]"
                        )}
                        onClick={() => handleOpenChat(lead)}
                      >
                        <div className={cn("absolute left-0 top-0 bottom-0 w-1", lead.ai_paused ? "bg-red-500" : (stale ? "bg-orange-500" : "bg-indigo-600"))} />
                        
                        <CardContent className="p-4 space-y-3 pl-5">
                           <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2">
                                 <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center text-slate-500 border border-slate-800 group-hover:border-indigo-500/30">
                                    <User className="w-4 h-4" />
                                 </div>
                                 <div>
                                    <p className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">
                                       {lead.nombre || lead.telefono || 'Anónimo'}
                                    </p>
                                    <p className="text-[9px] text-slate-500 font-mono truncate max-w-[150px]">{lead.ciudad || 'Ubicación pendiente...'}</p>
                                 </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                 {lead.ai_paused && <Badge variant="destructive" className="h-4 px-1 text-[8px] bg-red-600">STOP</Badge>}
                                 {stale && <Badge variant="outline" className="h-4 px-1 text-[8px] border-orange-500 text-orange-500 animate-pulse">ESTANCADO</Badge>}
                                 {missingEmail && <Badge variant="secondary" className="h-4 px-1 text-[8px] bg-yellow-500/10 text-yellow-500 border-yellow-500/30">FALTA EMAIL</Badge>}
                              </div>
                           </div>

                           {lead.summary && (
                              <p className="text-[10px] text-slate-400 italic line-clamp-2 leading-relaxed bg-slate-950 p-2 rounded border border-slate-800/50">
                                 "{lead.summary}"
                              </p>
                           )}

                           <div className="flex items-center justify-between pt-2 border-t border-slate-800/50">
                              <div className="flex items-center gap-2">
                                 <div className="text-[8px] text-slate-600 font-bold uppercase">
                                    MSG:
                                 </div>
                                 <div className="flex gap-0.5">
                                    {[1,2,3,4].map(n => (
                                       <div key={n} className={cn("w-1.5 h-1.5 rounded-full", lead.followup_stage >= n ? "bg-indigo-500 shadow-[0_0_5px_rgba(99,102,241,0.5)]" : "bg-slate-800")} />
                                    ))}
                                 </div>
                              </div>
                              <div className="text-[8px] text-slate-700 font-mono">
                                 {lead.last_message_at ? new Date(lead.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </div>
                           </div>
                        </CardContent>
                      </Card>
                    );
                  })}
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