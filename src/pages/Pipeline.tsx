import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trello, Loader2, Clock, TrendingUp, User, Smile, Meh, Frown, Fingerprint, Image, Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ChatViewer from '@/components/ChatViewer';

const Pipeline = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const columns = [
    { id: 'BAJO', title: '1. CONEXIÓN (DATOS)', icon: Fingerprint, color: 'border-blue-500/50 bg-blue-500/5', desc: 'Cazando Nombre/Ciudad' },
    { id: 'MEDIO', title: '2. SEDUCCIÓN (MEDIA)', icon: Image, color: 'border-yellow-500/50 bg-yellow-500/5', desc: 'Enamorando con Posters' },
    { id: 'ALTO', title: '3. CIERRE ($1500)', icon: Target, color: 'border-red-500/50 bg-red-500/5', desc: 'Link de Pago Enviado' }
  ];

  useEffect(() => {
    fetchLeads();
    
    const channel = supabase
      .channel('pipeline-live-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchLeads())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('leads')
      .select('*')
      .order('last_message_at', { ascending: false });
    
    if (data) setLeads(data);
    setLoading(false);
  };

  const getLeadsByIntent = (intent: string) => {
    return leads.filter(l => (l.buying_intent || 'BAJO').toUpperCase() === intent);
  };

  const handleOpenChat = (lead: any) => {
    setSelectedLead(lead);
    setIsChatOpen(true);
  };

  const getMoodColor = (mood: string) => {
    switch (mood?.toUpperCase()) {
      case 'POSITIVO': return 'text-green-500';
      case 'NEGATIVO': return 'text-red-500';
      default: return 'text-slate-500';
    }
  };

  return (
    <Layout>
      <div className="max-w-[1800px] mx-auto space-y-6 h-[calc(100vh-140px)] flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Trello className="w-8 h-8 text-indigo-500" />
              Estrategia Samurai: Tablero de Fases
            </h1>
            <p className="text-slate-400">Visualización en tiempo real del flujo de conversión de The Elephant Bowl.</p>
          </div>
          <Button variant="outline" className="border-slate-800 text-slate-400" onClick={fetchLeads}>
             <Clock className="w-4 h-4 mr-2" /> Sincronizar Radar
          </Button>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-0">
          {columns.map((col) => {
            const ColumnIcon = col.icon;
            const leadsInCol = getLeadsByIntent(col.id);
            
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
                  <p className="text-[10px] text-slate-500 font-mono italic">{col.desc}</p>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                  {leadsInCol.length === 0 ? (
                     <div className="h-32 flex flex-col items-center justify-center text-[10px] text-slate-700 italic uppercase gap-2 border border-dashed border-slate-800 rounded-xl">
                        <TrendingUp className="w-6 h-6 opacity-10" />
                        Sin prospectos en esta fase
                     </div>
                  ) : leadsInCol.map((lead) => (
                    <Card 
                      key={lead.id} 
                      className="bg-slate-900 border-slate-800 hover:border-indigo-500/50 transition-all cursor-pointer group relative overflow-hidden"
                      onClick={() => handleOpenChat(lead)}
                    >
                      <div className={cn("absolute left-0 top-0 bottom-0 w-1", lead.ai_paused ? "bg-red-500" : "bg-indigo-600")} />
                      
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
                            {lead.ai_paused && <Badge variant="destructive" className="h-4 px-1 text-[8px] bg-red-600">STOP</Badge>}
                         </div>

                         {lead.summary && (
                            <p className="text-[10px] text-slate-400 italic line-clamp-2 leading-relaxed bg-slate-950 p-2 rounded border border-slate-800/50">
                               "{lead.summary}"
                            </p>
                         )}

                         <div className="flex items-center justify-between pt-2 border-t border-slate-800/50">
                            <div className="flex items-center gap-2">
                               <div className={cn("p-1 rounded bg-black/40", getMoodColor(lead.estado_emocional_actual))}>
                                  {lead.estado_emocional_actual === 'POSITIVO' ? <Smile className="w-3 h-3" /> : 
                                   lead.estado_emocional_actual === 'NEGATIVO' ? <Frown className="w-3 h-3" /> : 
                                   <Meh className="w-3 h-3" />}
                               </div>
                               <span className="text-[8px] text-slate-600 font-bold uppercase">
                                  {lead.estado_emocional_actual || 'NEUTRO'}
                               </span>
                            </div>
                            <div className="text-[8px] text-slate-700 font-mono">
                               ACTIVO: {lead.last_message_at ? new Date(lead.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                            </div>
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
      </div>
    </Layout>
  );
};

export default Pipeline;