import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Search, Loader2, Phone, Zap, BrainCircuit, Clock, MapPin, UserCheck, Brain, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import ChatViewer from '@/components/ChatViewer';

const Leads = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    fetchLeads();

    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setLeads((prev) => [payload.new, ...prev]);
            toast.info('Nuevo lead detectado!');
          } else if (payload.eventType === 'UPDATE') {
            setLeads((prev) => prev.map((lead) => (lead.id === payload.new.id ? payload.new : lead)));
          }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('last_message_at', { ascending: false });

    if (!error && data) {
      const validLeads = data.filter(l => 
        (l.nombre && l.nombre !== 'Nuevo Lead WhatsApp' && l.nombre !== '') || 
        (l.telefono && l.telefono !== '')
      );
      setLeads(validLeads);
    }
    setLoading(false);
  };

  const handleRunAnalysis = async () => {
     setAnalyzing(true);
     toast.info("Iniciando análisis neuronal de conversaciones recientes...");
     try {
        const { data, error } = await supabase.functions.invoke('analyze-leads', {});
        if (error) throw error;
        
        if (data.results && data.results.length > 0) {
           toast.success(`Análisis completo: ${data.results.length} perfiles actualizados.`);
           fetchLeads();
        } else {
           toast.info(data.message || "No se encontraron leads pendientes de análisis.");
        }
     } catch (err: any) {
        toast.error("Error en análisis: " + err.message);
        if (err.message.includes("Gemini API Key")) {
           toast.warning("Ve a Ajustes > API Keys y configura tu Gemini API Key.");
        }
     } finally {
        setAnalyzing(false);
     }
  };

  const handleOpenChat = (lead: any) => {
    setSelectedLead(lead);
    setIsChatOpen(true);
  };

  const getAnalysisFreshness = (dateString: string | null) => {
     if (!dateString) return <span className="text-[9px] text-slate-600 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Pendiente</span>;
     const diff = new Date().getTime() - new Date(dateString).getTime();
     const minutes = Math.floor(diff / 60000);
     
     if (minutes < 60) return <span className="text-[9px] text-green-500 font-bold">Hace {minutes}m</span>;
     if (minutes < 1440) return <span className="text-[9px] text-slate-400">Hace {Math.floor(minutes/60)}h</span>;
     return <span className="text-[9px] text-slate-600">Hace {Math.floor(minutes/1440)}d</span>;
  };

  const filteredLeads = leads.filter(l => 
    l.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.telefono?.includes(searchTerm)
  );

  const isIdentified = (lead: any) => lead.nombre && !lead.nombre.includes('Nuevo Lead');

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
             <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
                Radar de Leads
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px]">
                   <Zap className="w-3 h-3 mr-1" /> LIVE
                </Badge>
             </h1>
             <p className="text-slate-400">Monitoreo en tiempo real de interacciones y perfiles psicográficos.</p>
          </div>
          <div className="flex gap-3 items-center w-full md:w-auto">
             <Button 
               variant="outline" 
               className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
               onClick={handleRunAnalysis}
               disabled={analyzing}
             >
                {analyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Analizar Chats Ahora
             </Button>
             <div className="relative w-full md:w-64">
               <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
               <Input 
                 placeholder="Buscar por nombre o teléfono..." 
                 className="pl-8 bg-slate-900 border-slate-800 text-slate-200 h-10"
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
               />
             </div>
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800">
            <CardTitle className="text-white flex items-center gap-2 text-sm uppercase tracking-widest">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              Últimos Prospectos Activos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-slate-900">
                  <TableHead className="text-slate-400 text-[10px] uppercase">Cliente</TableHead>
                  <TableHead className="text-slate-400 text-[10px] uppercase">Ubicación</TableHead>
                  <TableHead className="text-slate-400 text-[10px] uppercase text-center">IA Analysis</TableHead>
                  <TableHead className="text-slate-400 text-[10px] uppercase">Intención</TableHead>
                  <TableHead className="text-slate-400 text-[10px] uppercase">Estado IA</TableHead>
                  <TableHead className="text-slate-400 text-[10px] uppercase text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   <TableRow><TableCell colSpan={6} className="text-center h-32"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" /></TableCell></TableRow>
                ) : filteredLeads.map((lead) => (
                  <TableRow key={lead.id} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                         <span className={`font-bold flex items-center gap-2 ${isIdentified(lead) ? 'text-indigo-400' : 'text-slate-300'}`}>
                            {isIdentified(lead) && <UserCheck className="w-3.5 h-3.5" />}
                            {lead.nombre || 'Desconocido'}
                            {lead.ai_paused && <Badge variant="destructive" className="h-4 px-1 text-[8px] bg-red-600">STOP</Badge>}
                         </span>
                         <span className="text-[10px] text-slate-500 mt-0.5 font-mono">{lead.telefono || 'Sin número'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                       <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-red-500" />
                          <span className="text-xs text-slate-300 font-bold">{lead.ciudad || 'Detectando...'}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                       {lead.summary ? (
                          <div className="flex flex-col items-center gap-1" title={lead.summary}>
                             <Brain className="w-5 h-5 text-indigo-500" />
                             {getAnalysisFreshness(lead.last_analyzed_at)}
                          </div>
                       ) : (
                          <span className="text-[9px] text-slate-700 italic">Sin datos</span>
                       )}
                    </TableCell>
                    <TableCell>
                       <div className="flex flex-col gap-1 w-[100px]">
                          <div className="flex justify-between text-[8px] text-slate-500 font-bold uppercase">
                             <span>INTENT</span>
                             <span className={lead.buying_intent === 'ALTO' ? 'text-green-500' : 'text-slate-500'}>{lead.buying_intent || 'BAJO'}</span>
                          </div>
                          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                             <div className={`h-full ${lead.buying_intent === 'ALTO' ? 'bg-green-500' : lead.buying_intent === 'MEDIO' ? 'bg-yellow-500' : 'bg-slate-700'}`} style={{ width: lead.buying_intent === 'ALTO' ? '90%' : lead.buying_intent === 'MEDIO' ? '50%' : '10%' }} />
                          </div>
                       </div>
                    </TableCell>
                    <TableCell>
                       {!lead.ai_paused ? (
                          <div className="flex items-center gap-1.5">
                             <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                             <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Samurai Active</span>
                          </div>
                       ) : (
                          <div className="flex items-center gap-1.5">
                             <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                             <span className="text-[10px] text-red-500 uppercase font-bold tracking-tighter">Paused</span>
                          </div>
                       )}
                    </TableCell>
                    <TableCell className="text-right">
                       <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-8 text-[10px] font-bold" onClick={() => handleOpenChat(lead)}>
                          DETALLES <BrainCircuit className="w-3 h-3 ml-2" />
                       </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {selectedLead && <ChatViewer lead={selectedLead} open={isChatOpen} onOpenChange={setIsChatOpen} />}
      </div>
    </Layout>
  );
};

export default Leads;