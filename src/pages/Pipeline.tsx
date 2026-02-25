import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trello, Search, Loader2, MessageSquare, 
  MapPin, Clock, TrendingUp, Filter, BrainCircuit,
  Smile, Meh, Frown, User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ChatViewer from '@/components/ChatViewer';
import { toast } from 'sonner';

const Pipeline = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const columns = [
    { id: 'BAJO', title: 'Interés Inicial ❄️', color: 'border-blue-500/50 bg-blue-500/5' },
    { id: 'MEDIO', title: 'Calificación ⚡', color: 'border-yellow-500/50 bg-yellow-500/5' },
    { id: 'ALTO', title: 'Cierre Hot 🔥', color: 'border-red-500/50 bg-red-500/5' }
  ];

  useEffect(() => {
    fetchLeads();
    
    // Suscripción en tiempo real para cambios en el pipeline
    const channel = supabase
      .channel('pipeline-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (payload) => {
        setLeads(prev => prev.map(l => l.id === payload.new.id ? payload.new : l));
      })
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
    return leads.filter(l => (l.buying_intent || 'BAJO') === intent);
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
              Pipeline de Conversión
            </h1>
            <p className="text-slate-400">Flujo táctico de prospectos segmentados por intención.</p>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" className="border-slate-800 text-slate-400" onClick={fetchLeads}>
                <Clock className="w-4 h-4 mr-2" /> Actualizar Radar
             </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
             <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-0">
            {columns.map((col) => (
              <div key={col.id} className={cn("rounded-xl border flex flex-col min-h-0", col.color)}>
                <div className="p-4 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/40 rounded-t-xl">
                  <h3 className="font-bold text-sm text-slate-200 uppercase tracking-widest">{col.title}</h3>
                  <Badge className="bg-slate-800 text-slate-400 border-slate-700">{getLeadsByIntent(col.id).length}</Badge>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                  {getLeadsByIntent(col.id).length === 0 ? (
                     <div className="h-20 flex items-center justify-center text-[10px] text-slate-600 italic uppercase">
                        Sin prospectos en esta fase
                     </div>
                  ) : getLeadsByIntent(col.id).map((lead) => (
                    <Card 
                      key={lead.id} 
                      className="bg-slate-900 border-slate-800 hover:border-indigo-500/50 transition-all cursor-pointer group shadow-lg"
                      onClick={() => handleOpenChat(lead)}
                    >
                      <CardContent className="p-4 space-y-3">
                         <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                               <div className="w-8 h-8 rounded-lg bg-indigo-600/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
                                  <User className="w-4 h-4" />
                               </div>
                               <div>
                                  <p className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors truncate max-w-[120px]">
                                     {lead.nombre || lead.telefono || 'Anónimo'}
                                  </p>
                                  <p className="text-[9px] text-slate-500 font-mono">{lead.ciudad || 'Ubicación...'}</p>
                               </div>
                            </div>
                            {lead.ai_paused && <Badge className="bg-red-600 text-[8px] h-4">STOP</Badge>}
                         </div>

                         {lead.summary && (
                            <p className="text-[10px] text-slate-400 italic line-clamp-2 leading-relaxed bg-slate-950/50 p-2 rounded border border-slate-800/50">
                               "{lead.summary}"
                            </p>
                         )}

                         <div className="flex items-center justify-between pt-2 border-t border-slate-800/50">
                            <div className="flex items-center gap-2">
                               <div className={cn("p-1 rounded bg-slate-950 border border-slate-800", getMoodColor(lead.estado_emocional_actual))}>
                                  {lead.estado_emocional_actual === 'POSITIVO' ? <Smile className="w-3 h-3" /> : 
                                   lead.estado_emocional_actual === 'NEGATIVO' ? <Frown className="w-3 h-3" /> : 
                                   <Meh className="w-3 h-3" />}
                               </div>
                               <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">
                                  {lead.estado_emocional_actual || 'NEUTRO'}
                               </span>
                            </div>
                            <div className="flex items-center gap-1 text-[9px] text-slate-600 font-mono">
                               <Clock className="w-3 h-3" />
                               {lead.last_message_at ? new Date(lead.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '---'}
                            </div>
                         </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedLead && <ChatViewer lead={selectedLead} open={isChatOpen} onOpenChange={setIsChatOpen} />}
      </div>
    </Layout>
  );
};

export default Pipeline;