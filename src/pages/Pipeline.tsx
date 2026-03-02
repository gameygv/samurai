import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trello, Loader2, Clock, TrendingUp, User, Fingerprint, Image, Target, AlertCircle, DollarSign, UserPlus, Mail, ShieldCheck
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
    { id: 'BAJO', title: '1. CONEXIÓN', icon: Fingerprint, color: 'border-blue-500/50 bg-blue-500/5', desc: 'Datos Incompletos' },
    { id: 'MEDIO', title: '2. SEDUCCIÓN', icon: Image, color: 'border-yellow-500/50 bg-yellow-500/5', desc: 'Interés Validado' },
    { id: 'ALTO', title: '3. CIERRE ($)', icon: Target, color: 'border-red-500/50 bg-red-500/5', desc: 'Link Enviado' }
  ];

  useEffect(() => {
    fetchLeads();
    
    // Monitor de cambios para notificar descubrimientos de datos
    const channel = supabase
      .channel('pipeline-live-v4')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (payload) => {
         const oldLead = leads.find(l => l.id === payload.new.id);
         if (oldLead && !oldLead.email && payload.new.email) {
            toast.success(`¡Samurai capturó un email de ${payload.new.nombre || payload.new.telefono}!`, {
               description: "El dato ya está en el CRM y enviado a Meta CAPI.",
               icon: <Mail className="text-emerald-500" />
            });
         }
         fetchLeads();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [leads]);

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
  const isStale = (lastDate: string | null) => lastDate ? (new Date().getTime() - new Date(lastDate).getTime() > 48 * 60 * 60 * 1000) : false;

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
              <div><h3 className="text-xs font-bold text-slate-500 uppercase">Salud Meta CAPI</h3><p className="text-2xl font-bold text-white">{capiReadyCount} <span className="text-xs text-slate-500 font-normal">Listos con Email</span></p></div>
           </Card>
           <Card className="bg-slate-900/50 border-emerald-500/30 p-4 flex items-center justify-between border-l-4 border-l-emerald-500">
              <div className="flex items-center gap-4">
                 <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400"><DollarSign className="w-6 h-6" /></div>
                 <div><h3 className="text-xs font-bold text-slate-500 uppercase">Valor en Cierre</h3><p className="text-2xl font-bold text-white">${totalValue.toLocaleString()}</p></div>
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
                   <h3 className="font-bold text-xs text-white uppercase tracking-widest flex items-center gap-2">
                      <col.icon className="w-4 h-4 text-indigo-400" /> {col.title}
                   </h3>
                   <Badge className="bg-slate-950 text-indigo-400 border-indigo-500/20">{leadsInCol.length}</Badge>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar bg-slate-950/20">
                  {leadsInCol.map((lead) => (
                    <Card key={lead.id} className={cn("bg-slate-900 border-slate-800 hover:border-indigo-500/50 transition-all cursor-pointer group relative overflow-hidden", isStale(lead.last_message_at) && col.id === 'ALTO' && "border-red-600/50 shadow-[0_0_15px_rgba(220,38,38,0.1)]")} onClick={() => { setSelectedLead(lead); setIsChatOpen(true); }}>
                      <div className={cn("absolute left-0 top-0 bottom-0 w-1", lead.ai_paused ? "bg-red-500" : "bg-indigo-600")} />
                      <CardContent className="p-4 pl-5 space-y-3">
                         <div className="flex justify-between items-start">
                            <div><p className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">{lead.nombre || lead.telefono}</p><p className="text-[9px] text-slate-500 font-mono truncate">{lead.ciudad || 'Pendiente...'}</p></div>
                            <div className="flex flex-col items-end gap-1">
                               {lead.ai_paused && <Badge variant="destructive" className="h-4 px-1 text-[8px] bg-red-600">STOP</Badge>}
                               {!lead.email && <Badge variant="secondary" className="h-4 px-1 text-[8px] bg-yellow-500/10 text-yellow-500 border-yellow-500/30">FALTA EMAIL</Badge>}
                            </div>
                         </div>
                         <div className="flex items-center justify-between pt-2 border-t border-slate-800/50 text-[8px] text-slate-600">
                            <span className="font-bold uppercase">MSG: {lead.followup_stage}</span>
                            <span className="font-mono">{lead.last_message_at ? new Date(lead.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                         </div>
                      </CardContent>
                    </Card>
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